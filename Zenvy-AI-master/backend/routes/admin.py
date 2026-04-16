import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Claim, Policy, RiskSnapshot, User
from schemas import AdminAnalyticsResponse, AdminPredictionsResponse, AdminStats, ClaimReviewRequest
from services.analytics import build_admin_analytics, build_predictions
from services.notifications_service import create_notification
from services.payments import build_upi_deep_link, generate_payment_reference
from services.trigger_engine import generate_upi_id

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStats)
def get_stats(db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    total_policies = db.query(Policy).count()
    active_policies = db.query(Policy).filter(Policy.status == "active").count()
    total_claims = db.query(Claim).count()
    total_payout = db.query(func.sum(Claim.payout_amount)).filter(Claim.status.in_(["approved", "paid"])).scalar() or 0.0
    fraud_alerts = db.query(Claim).filter(Claim.fraud_flagged.is_(True)).count()
    avg_risk = db.query(func.avg(Policy.risk_score)).scalar() or 0.0
    roles = db.query(User.role, func.count(User.id)).group_by(User.role).all()
    return AdminStats(
        total_users=total_users,
        users_by_role={role: count for role, count in roles},
        total_policies=total_policies,
        active_policies=active_policies,
        total_claims=total_claims,
        total_payout=round(total_payout, 2),
        fraud_alerts=fraud_alerts,
        avg_risk_score=round(float(avg_risk), 3),
    )


@router.get("/users")
def get_all_users(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role != "admin").all()
    result = []
    for user in users:
        active_policy = db.query(Policy).filter(Policy.user_id == user.id, Policy.status == "active").first()
        claims_count = db.query(Claim).filter(Claim.user_id == user.id).count()
        fraud_count = db.query(Claim).filter(Claim.user_id == user.id, Claim.fraud_flagged.is_(True)).count()
        result.append(
            {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "city": user.city,
                "lat": user.lat,
                "lon": user.lon,
                "lang": user.lang,
                "years_exp": user.years_exp,
                "has_active_policy": active_policy is not None,
                "policy_risk_level": active_policy.risk_level if active_policy else "none",
                "policy_risk_score": active_policy.risk_score if active_policy else 0.0,
                "claims_count": claims_count,
                "fraud_flags": fraud_count,
                "joined": user.created_at.isoformat(),
            }
        )
    return result


@router.get("/claims")
def get_all_claims(db: Session = Depends(get_db)):
    claims = db.query(Claim).order_by(Claim.created_at.desc()).limit(200).all()
    payload = []
    for claim in claims:
        user = db.query(User).filter(User.id == claim.user_id).first()
        payload.append(
            {
                "id": claim.id,
                "user_id": claim.user_id,
                "user_name": user.name if user else "Unknown",
                "user_role": user.role if user else "Unknown",
                "user_city": user.city if user else "Unknown",
                "claim_type": claim.claim_type,
                "trigger_event": claim.trigger_event,
                "payout_amount": claim.payout_amount,
                "status": claim.status,
                "fraud_flagged": claim.fraud_flagged,
                "fraud_score": claim.fraud_score,
                "fraud_reasons": json.loads(claim.fraud_reasons or "[]"),
                "review_note": claim.review_note,
                "reviewed_by": claim.reviewed_by,
                "reviewed_at": claim.reviewed_at.isoformat() if claim.reviewed_at else None,
                "payout_reference": claim.payout_reference,
                "created_at": claim.created_at.isoformat(),
            }
        )
    return payload


@router.get("/map-data")
def get_map_data(db: Session = Depends(get_db)):
    markers = []
    for user in db.query(User).filter(User.role != "admin").all():
        policy = db.query(Policy).filter(Policy.user_id == user.id, Policy.status == "active").first()
        markers.append(
            {
                "id": user.id,
                "name": user.name,
                "role": user.role,
                "city": user.city,
                "lat": user.lat,
                "lon": user.lon,
                "risk_level": policy.risk_level if policy else "none",
                "risk_score": policy.risk_score if policy else 0.0,
                "has_policy": policy is not None,
            }
        )
    return markers


@router.get("/fraud-alerts")
def get_fraud_alerts(db: Session = Depends(get_db)):
    return get_fraud_claims(db)


@router.get("/fraud-claims")
def get_fraud_claims(db: Session = Depends(get_db)):
    claims = (
        db.query(Claim)
        .filter(Claim.fraud_flagged.is_(True), Claim.status != "rejected")
        .order_by(Claim.created_at.desc())
        .all()
    )
    response = []
    for claim in claims:
        user = db.query(User).filter(User.id == claim.user_id).first()
        response.append(
            {
                "claim_id": claim.id,
                "user_id": claim.user_id,
                "user_name": user.name if user else "Unknown",
                "user_role": user.role if user else "Unknown",
                "city": user.city if user else "Unknown",
                "fraud_score": claim.fraud_score,
                "fraud_reasons": json.loads(claim.fraud_reasons or "[]"),
                "trigger_event": claim.trigger_event,
                "payout_amount": claim.payout_amount,
                "status": claim.status,
                "review_note": claim.review_note,
                "created_at": claim.created_at.isoformat(),
            }
        )
    return response


@router.post("/review-claim")
def review_claim(req: ClaimReviewRequest, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == req.claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    reviewer_id = req.reviewed_by or 1
    claim.review_note = req.review_note
    claim.reviewed_by = reviewer_id
    claim.reviewed_at = datetime.utcnow()

    if req.action == "approved":
        claim.status = "approved"
        claim.upi_transaction_id = claim.upi_transaction_id or generate_upi_id()
        claim.payout_reference = claim.payout_reference or generate_payment_reference("ZRV")
        claim.payout_link = claim.payout_link or build_upi_deep_link(claim.payout_amount)
        claim.paid_at = datetime.utcnow()
        create_notification(
            db=db,
            user_id=claim.user_id,
            notif_type="claim_approved",
            title="Claim approved",
            message=f"Your claim #{claim.id} has been approved and payout is being processed.",
            metadata={"claim_id": claim.id, "transaction_id": claim.upi_transaction_id},
        )
    else:
        claim.status = "rejected"
        create_notification(
            db=db,
            user_id=claim.user_id,
            notif_type="claim_rejected",
            title="Claim rejected",
            message=f"Your claim #{claim.id} was rejected after review.",
            metadata={"claim_id": claim.id, "review_note": req.review_note},
        )

    db.commit()
    return {"success": True, "claim_id": claim.id, "status": claim.status}


@router.get("/risk-trend")
def get_risk_trend(db: Session = Depends(get_db)):
    snapshots = db.query(RiskSnapshot).order_by(RiskSnapshot.created_at.desc()).limit(30).all()
    return [
        {
            "date": snapshot.date,
            "risk_score": round(snapshot.risk_score, 3),
            "risk_level": snapshot.risk_level,
            "rainfall_mm": snapshot.rainfall_mm,
            "aqi": snapshot.aqi,
        }
        for snapshot in reversed(snapshots)
    ]


@router.get("/analytics", response_model=AdminAnalyticsResponse)
def get_analytics(db: Session = Depends(get_db)):
    return build_admin_analytics(db)


@router.get("/predictions", response_model=AdminPredictionsResponse)
def get_predictions(db: Session = Depends(get_db)):
    return build_predictions(db)


@router.post("/claim/{claim_id}/status")
def update_claim_status(claim_id: int, status: str, db: Session = Depends(get_db)):
    status_map = {"paid": "approved", "pending": "pending", "rejected": "rejected"}
    mapped = status_map.get(status, status)
    if mapped not in {"approved", "pending", "rejected"}:
        raise HTTPException(status_code=400, detail="Invalid status")
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    claim.status = mapped
    if mapped == "approved":
        claim.paid_at = datetime.utcnow()
        claim.upi_transaction_id = claim.upi_transaction_id or generate_upi_id()
    db.commit()
    return {"success": True, "claim_id": claim_id, "new_status": mapped}
