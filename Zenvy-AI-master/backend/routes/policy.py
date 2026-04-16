from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Policy, User
from schemas import PolicyCreate, PolicyOut
from services.notifications_service import create_notification

router = APIRouter(prefix="/policy", tags=["Policy"])


@router.post("/buy", response_model=PolicyOut)
def buy_policy(user_id: int, req: PolicyCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(Policy).filter(Policy.user_id == user_id, Policy.status == "active").first()
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active policy.")

    policy = Policy(
        user_id=user_id,
        weekly_premium=req.weekly_premium,
        coverage_amount=req.coverage_amount,
        risk_level=req.risk_level,
        risk_score=req.risk_score,
        status="active",
        payment_method=req.payment_method,
        payment_reference=req.payment_reference,
        start_date=datetime.utcnow(),
        end_date=datetime.utcnow() + timedelta(days=7),
    )
    db.add(policy)
    db.flush()

    create_notification(
        db=db,
        user_id=user_id,
        notif_type="policy_purchased",
        title="Policy activated",
        message=f"Your coverage is active until {policy.end_date.strftime('%d %b %Y')}.",
        metadata={"policy_id": policy.id, "payment_reference": req.payment_reference},
    )

    db.commit()
    db.refresh(policy)
    return policy


@router.get("/active/{user_id}", response_model=PolicyOut)
def get_active_policy(user_id: int, db: Session = Depends(get_db)):
    policy = db.query(Policy).filter(Policy.user_id == user_id, Policy.status == "active").first()
    if not policy:
        raise HTTPException(status_code=404, detail="No active policy found")
    return policy


@router.get("/history/{user_id}")
def get_policy_history(user_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Policy)
        .filter(Policy.user_id == user_id)
        .order_by(Policy.created_at.desc())
        .all()
    )


@router.post("/expire/{policy_id}")
def expire_policy(policy_id: int, db: Session = Depends(get_db)):
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    policy.status = "expired"
    db.commit()
    return {"message": "Policy expired"}
