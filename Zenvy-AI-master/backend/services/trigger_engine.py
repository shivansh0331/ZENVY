from __future__ import annotations

import json
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from models import Claim, Policy, User
from services.fraud_detection import run_fraud_check
from services.notifications_service import create_alert_and_notification, create_notification
from services.payments import build_upi_deep_link, generate_payment_reference
from services.platform_simulator import get_mock_platform_metrics


TRIGGERS = {
    "rain_15mm": {
        "threshold": 15.0,
        "field": "rainfall_mm",
        "severity": 0.5,
        "duration": 1.0,
        "title": "Rain disruption detected",
        "alert_type": "weather_disruption",
    },
    "flood_40mm": {
        "threshold": 40.0,
        "field": "rainfall_mm",
        "severity": 0.8,
        "duration": 2.0,
        "title": "Flood disruption detected",
        "alert_type": "weather_disruption",
    },
    "aqi_300": {
        "threshold": 300.0,
        "field": "aqi",
        "severity": 0.6,
        "duration": 1.0,
        "title": "Hazardous AQI disruption detected",
        "alert_type": "weather_disruption",
    },
    "heat_43": {
        "threshold": 43.0,
        "field": "temperature",
        "severity": 0.5,
        "duration": 1.0,
        "title": "Extreme heat disruption detected",
        "alert_type": "weather_disruption",
    },
    "platform_drop": {
        "threshold": 60.0,
        "field": "order_drop_pct",
        "severity": 0.7,
        "duration": 1.0,
        "title": "Order volume collapsed",
        "alert_type": "platform_disruption",
    },
    "traffic": {
        "threshold": 75.0,
        "field": "severity_index",
        "severity": 0.55,
        "duration": 1.0,
        "title": "Traffic disruption detected",
        "alert_type": "traffic_disruption",
    },
    "curfew": {
        "threshold": 1.0,
        "field": "severity_index",
        "severity": 0.9,
        "duration": 2.0,
        "title": "Curfew or lockdown in effect",
        "alert_type": "government_disruption",
    },
    "strike": {
        "threshold": 1.0,
        "field": "severity_index",
        "severity": 0.85,
        "duration": 2.0,
        "title": "City shutdown or strike detected",
        "alert_type": "city_disruption",
    },
    "admin": {
        "threshold": 0.0,
        "field": "severity_index",
        "severity": 0.65,
        "duration": 1.0,
        "title": "Admin-triggered disruption",
        "alert_type": "admin_event",
    },
}

DAILY_INCOME = {
    "food_delivery": 800,
    "grocery_delivery": 700,
    "ecommerce_delivery": 750,
}


def calculate_payout(role: str, severity: float, duration: float) -> float:
    daily_income = DAILY_INCOME.get(role, 750)
    return round(daily_income * severity * duration, 2)


def generate_upi_id() -> str:
    return f"ZENVY{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{str(uuid.uuid4())[:6].upper()}"


def process_parametric_trigger(
    event_type: str,
    trigger_value: float,
    city: str,
    custom_message: str,
    db: Session,
    severity_override: float | None = None,
    duration_days: float | None = None,
) -> dict:
    if event_type not in TRIGGERS:
        return {"error": f"Unknown event type: {event_type}"}

    config = TRIGGERS[event_type]
    threshold = config["threshold"]
    if event_type != "admin" and trigger_value < threshold:
        return {"error": f"Threshold not breached for {event_type}", "threshold": threshold}

    severity = severity_override if severity_override is not None else config["severity"]
    duration = duration_days if duration_days is not None else config["duration"]

    active_policies = db.query(Policy).filter(Policy.status == "active").all()
    affected = []
    for policy in active_policies:
        user = db.query(User).filter(User.id == policy.user_id).first()
        if user and (city == "all" or user.city == city):
            affected.append((user, policy))

    payouts = []
    total_paid_amount = 0.0

    for user, policy in affected:
        message = custom_message or f"{config['title']} in {user.city}. Eligible claims are being processed."
        create_alert_and_notification(
            db=db,
            user_id=user.id,
            alert_type=config["alert_type"],
            title=config["title"],
            message=message,
            severity="critical" if severity >= 0.75 else "warning",
            event_code=event_type,
            trigger_value=trigger_value,
            trigger_threshold=threshold,
        )

        rainfall_mm = trigger_value if event_type in {"rain_15mm", "flood_40mm"} else 0.0
        aqi = trigger_value if event_type == "aqi_300" else 100.0
        fraud = run_fraud_check(
            user_id=user.id,
            trigger_event=event_type,
            db=db,
            worker_lat=user.lat,
            worker_lon=user.lon,
            city=user.city,
            rainfall_mm=rainfall_mm,
            aqi=aqi,
        )
        payout = calculate_payout(user.role, severity, duration)
        payout_reference = generate_payment_reference("ZCL")
        payout_link = build_upi_deep_link(payout)
        paid = not fraud["is_flagged"]
        claim = Claim(
            user_id=user.id,
            policy_id=policy.id,
            claim_type="parametric",
            trigger_event=event_type,
            payout_amount=payout,
            severity=severity,
            duration_days=duration,
            status="approved" if paid else "pending",
            fraud_flagged=fraud["is_flagged"],
            fraud_score=fraud["fraud_score"],
            fraud_reasons=json.dumps(fraud["flagged_reasons"]),
            description=message,
            processing_started_at=datetime.utcnow(),
            upi_transaction_id=generate_upi_id() if paid else None,
            payout_reference=payout_reference,
            payout_link=payout_link if paid else None,
            paid_at=datetime.utcnow() if paid else None,
            event_metadata=json.dumps({"city": user.city, "trigger_value": trigger_value}),
        )
        db.add(claim)
        create_notification(
            db=db,
            user_id=user.id,
            notif_type="claim_auto_created",
            title="Claim auto-created",
            message=f"A parametric claim was created for {event_type.replace('_', ' ')}.",
            metadata={"event_type": event_type, "payout_amount": payout},
        )
        create_notification(
            db=db,
            user_id=user.id,
            notif_type="fraud_check_passed" if paid else "fraud_check_failed",
            title="Fraud review status",
            message="Fraud checks passed and payout is ready." if paid else "Claim requires fraud review before payout.",
            metadata={"fraud_score": fraud["fraud_score"], "reasons": fraud["flagged_reasons"]},
        )
        if paid:
            create_notification(
                db=db,
                user_id=user.id,
                notif_type="payout_processed",
                title="Payout processed",
                message=f"Rs {payout:.0f} has been processed to your payout rail.",
                metadata={"transaction_id": claim.upi_transaction_id, "payout_reference": payout_reference},
            )
            total_paid_amount += payout

        payouts.append(
            {
                "user_id": user.id,
                "user_name": user.name,
                "city": user.city,
                "payout": payout,
                "status": claim.status,
                "fraud_flagged": fraud["is_flagged"],
            }
        )

    db.commit()

    return {
        "event_type": event_type,
        "trigger_value": trigger_value,
        "city": city,
        "workers_affected": len(affected),
        "payouts_created": len([item for item in payouts if not item["fraud_flagged"]]),
        "fraud_flagged": len([item for item in payouts if item["fraud_flagged"]]),
        "total_payout_amount": round(total_paid_amount, 2),
        "payout_details": payouts,
    }


def check_weather_triggers(weather_data: dict, city: str, db: Session) -> list[dict]:
    triggered = []
    for event_type, config in TRIGGERS.items():
        if event_type in {"admin", "platform_drop", "traffic", "curfew", "strike"}:
            continue
        actual_value = weather_data.get(config["field"], 0.0)
        if actual_value >= config["threshold"]:
            triggered.append(
                process_parametric_trigger(
                    event_type=event_type,
                    trigger_value=actual_value,
                    city=city,
                    custom_message="Auto-triggered from live monitoring",
                    db=db,
                )
            )
    return triggered


def check_platform_order_drop(city: str, db: Session) -> dict | None:
    metrics = get_mock_platform_metrics(city)
    if metrics["threshold_breached"]:
        return process_parametric_trigger(
            event_type="platform_drop",
            trigger_value=metrics["order_drop_pct"],
            city=city,
            custom_message=f"Order volume dropped by {metrics['order_drop_pct']}% in {city}.",
            db=db,
        )
    return None
