import json
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Alert, Claim, Policy, User
from schemas import ClaimCreate, ClaimOut, TriggerRequest
from services.fraud_detection import run_fraud_check
from services.notifications_service import create_notification
from services.payments import build_upi_deep_link, generate_payment_reference
from services.trigger_engine import calculate_payout, generate_upi_id, process_parametric_trigger

router = APIRouter(prefix="/claims", tags=["Claims"])


@router.post("/file", response_model=ClaimOut)
def file_claim(user_id: int, req: ClaimCreate, db: Session = Depends(get_db)):
    policy = (
        db.query(Policy)
        .filter(Policy.id == req.policy_id, Policy.user_id == user_id, Policy.status == "active")
        .first()
    )
    if not policy:
        raise HTTPException(status_code=404, detail="No active policy found for this ID")

    user = db.query(User).filter(User.id == user_id).first()
    fraud = run_fraud_check(
        user_id=user_id,
        trigger_event="manual_claim",
        db=db,
        worker_lat=user.lat,
        worker_lon=user.lon,
        city=user.city,
    )

    payout = calculate_payout(user.role, severity=0.5, duration=1.0)
    paid = not fraud["is_flagged"]
    claim = Claim(
        user_id=user_id,
        policy_id=req.policy_id,
        claim_type="manual",
        trigger_event="manual_claim",
        payout_amount=payout,
        severity=0.5,
        duration_days=1.0,
        status="approved" if paid else "pending",
        fraud_flagged=fraud["is_flagged"],
        fraud_score=fraud["fraud_score"],
        fraud_reasons=json.dumps(fraud["flagged_reasons"]),
        payout_reference=generate_payment_reference("ZMAN"),
        payout_link=build_upi_deep_link(payout) if paid else None,
        upi_transaction_id=generate_upi_id() if paid else None,
        description=req.description,
        processing_started_at=datetime.utcnow(),
        paid_at=datetime.utcnow() if paid else None,
    )
    db.add(claim)
    db.flush()

    create_notification(
        db=db,
        user_id=user_id,
        notif_type="claim_created",
        title="Claim filed",
        message="Your claim has been filed and is being processed.",
        metadata={"claim_id": claim.id},
    )
    create_notification(
        db=db,
        user_id=user_id,
        notif_type="fraud_check_passed" if paid else "fraud_check_failed",
        title="Fraud screening updated",
        message="Claim cleared and payout queued." if paid else "Claim moved to fraud review.",
        metadata={"claim_id": claim.id, "fraud_score": fraud["fraud_score"]},
    )
    db.commit()
    db.refresh(claim)
    return claim


@router.get("/history/{user_id}")
def get_claims_history(user_id: int, db: Session = Depends(get_db)):
    claims = (
        db.query(Claim)
        .filter(Claim.user_id == user_id)
        .order_by(Claim.created_at.desc())
        .all()
    )
    response = []
    for claim in claims:
        response.append(
            {
                "id": claim.id,
                "claim_type": claim.claim_type,
                "trigger_event": claim.trigger_event,
                "payout_amount": claim.payout_amount,
                "status": claim.status,
                "fraud_flagged": claim.fraud_flagged,
                "fraud_score": claim.fraud_score,
                "fraud_reasons": json.loads(claim.fraud_reasons or "[]"),
                "upi_transaction_id": claim.upi_transaction_id,
                "payout_reference": claim.payout_reference,
                "payout_link": claim.payout_link,
                "description": claim.description,
                "review_note": claim.review_note,
                "created_at": claim.created_at,
                "paid_at": claim.paid_at,
                "upi_receipt": {
                    "amount": f"Rs {claim.payout_amount:.0f}",
                    "transaction_id": claim.upi_transaction_id,
                    "reference": claim.payout_reference,
                    "link": claim.payout_link,
                    "timestamp": claim.paid_at.isoformat() if claim.paid_at else None,
                    "status": claim.status.upper(),
                    "bank": "ZENVY Simulated UPI Rail",
                } if claim.upi_transaction_id or claim.payout_reference else None,
            }
        )
    return response


@router.post("/trigger")
def admin_trigger(req: TriggerRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    return process_parametric_trigger(
        event_type=req.event_type,
        trigger_value=req.trigger_value,
        city=req.city,
        custom_message=req.message,
        db=db,
        severity_override=req.severity_override,
        duration_days=req.duration_days,
    )


@router.get("/alerts/{user_id}")
def get_alerts(user_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Alert)
        .filter((Alert.user_id == user_id) | (Alert.user_id.is_(None)))
        .order_by(Alert.created_at.desc())
        .limit(20)
        .all()
    )


@router.post("/alerts/{alert_id}/read")
def mark_alert_read(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert:
        alert.is_read = True
        db.commit()
    return {"message": "Alert marked as read"}
