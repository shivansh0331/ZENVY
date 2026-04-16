import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Notification, Policy, User
from schemas import NotificationCreateRequest
from services.notifications_service import create_notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/{user_id}")
def get_notifications(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    active_policy = (
        db.query(Policy)
        .filter(Policy.user_id == user_id, Policy.status == "active")
        .order_by(Policy.created_at.desc())
        .first()
    )
    if active_policy and active_policy.end_date:
        days_left = (active_policy.end_date - datetime.utcnow()).days
        if days_left <= 2:
            create_notification(
                db=db,
                user_id=user_id,
                notif_type="policy_expiring",
                title="Policy expiry reminder",
                message="Your policy is close to expiry. Renew to stay protected.",
                metadata={"policy_id": active_policy.id},
            )
            db.commit()

    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(30)
        .all()
    )
    return [
        {
            "id": notification.id,
            "title": notification.title,
            "message": notification.message,
            "type": notification.type,
            "is_read": notification.is_read,
            "metadata": json.loads(notification.metadata_json or "{}"),
            "created_at": notification.created_at.isoformat() if notification.created_at else None,
        }
        for notification in notifications
    ]


@router.post("/{user_id}/read-all")
def mark_all_read(user_id: int, db: Session = Depends(get_db)):
    notifications = db.query(Notification).filter(Notification.user_id == user_id).all()
    for notification in notifications:
        notification.is_read = True
    db.commit()
    return {"success": True, "message": "All notifications marked as read"}


@router.post("/create")
def create_notification_endpoint(req: NotificationCreateRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    notification = create_notification(
        db=db,
        user_id=req.user_id,
        notif_type=req.type,
        title=req.title,
        message=req.message,
        metadata=req.metadata,
    )
    db.commit()
    db.refresh(notification)
    return {"success": True, "notification_id": notification.id}
