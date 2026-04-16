import json
from typing import Any

from sqlalchemy.orm import Session

from models import Alert, Notification


NOTIFICATION_TITLES = {
    "claim_auto_created": "New Claim Created",
    "fraud_check_passed": "Fraud Review Completed",
    "fraud_check_failed": "Claim Under Review",
    "payout_processed": "Payout Processed",
    "payout_ready": "Payout Ready",
    "weather_disruption": "Weather Alert",
    "platform_disruption": "Platform Alert",
    "traffic_disruption": "Traffic Alert",
    "government_disruption": "Government Alert",
    "city_disruption": "City Alert",
    "admin_event": "System Alert",
}


def create_notification(
    db: Session,
    user_id: int,
    notif_type: str,
    message: str,
    title: str | None = None,
    metadata: dict[str, Any] | None = None,
):
    notification = Notification(
        user_id=user_id,
        type=notif_type,
        title=title or NOTIFICATION_TITLES.get(notif_type, notif_type.replace("_", " ").title()),
        message=message,
        metadata_json=json.dumps(metadata or {}),
        is_read=False,
    )
    db.add(notification)
    return notification


def create_alert_and_notification(
    db: Session,
    user_id: int,
    alert_type: str,
    title: str,
    message: str,
    severity: str = "warning",
    event_code: str | None = None,
    trigger_value: float | None = None,
    trigger_threshold: float | None = None,
):
    alert = Alert(
        user_id=user_id,
        alert_type=alert_type,
        severity=severity,
        title=title,
        message=message,
        event_code=event_code,
        trigger_value=trigger_value,
        trigger_threshold=trigger_threshold,
        is_read=False,
    )
    db.add(alert)
    create_notification(
        db=db,
        user_id=user_id,
        notif_type=alert_type,
        title=title,
        message=message,
        metadata={
            "event_code": event_code,
            "trigger_value": trigger_value,
            "trigger_threshold": trigger_threshold,
        },
    )
    return alert
