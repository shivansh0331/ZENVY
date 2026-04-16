from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Claim, Policy, RiskSnapshot, User


def build_admin_analytics(db: Session) -> dict:
    claims = db.query(Claim).order_by(Claim.created_at.asc()).all()
    policies = db.query(Policy).all()
    active_policies = [policy for policy in policies if policy.status == "active"]
    paid_claims = [claim for claim in claims if claim.status in {"approved", "paid"}]
    flagged_claims = [claim for claim in claims if claim.fraud_flagged]

    total_payout = round(sum(claim.payout_amount for claim in paid_claims), 2)
    total_premium = round(sum(policy.weekly_premium for policy in active_policies), 2)
    avg_payout_time_hours = 0.0
    settled = [claim for claim in paid_claims if claim.paid_at and claim.created_at]
    if settled:
        avg_payout_time_hours = round(
            sum((claim.paid_at - claim.created_at).total_seconds() / 3600 for claim in settled) / len(settled),
            2,
        )

    daily_counter: dict[str, int] = defaultdict(int)
    weekly_counter: dict[str, int] = defaultdict(int)
    city_breakdown: dict[str, dict] = defaultdict(lambda: {"risk_score": 0.0, "count": 0, "active_policies": 0})

    for claim in claims:
        day_key = claim.created_at.strftime("%Y-%m-%d")
        week_key = claim.created_at.strftime("%Y-W%W")
        daily_counter[day_key] += 1
        weekly_counter[week_key] += 1
        if claim.user:
            city_breakdown[claim.user.city]["count"] += 1

    for policy in active_policies:
        city = policy.user.city if policy.user else "Unknown"
        city_breakdown[city]["active_policies"] += 1
        city_breakdown[city]["risk_score"] += policy.risk_score

    claims_over_time = [
        {
            "date": day,
            "claims": count,
            "week_bucket": datetime.strptime(day, "%Y-%m-%d").strftime("%Y-W%W"),
        }
        for day, count in sorted(daily_counter.items())
    ]

    city_risk_distribution = []
    for city, data in city_breakdown.items():
        average_risk = round(data["risk_score"] / data["active_policies"], 3) if data["active_policies"] else 0.0
        city_risk_distribution.append(
            {
                "city": city,
                "claims": data["count"],
                "active_policies": data["active_policies"],
                "average_risk_score": average_risk,
            }
        )

    city_risk_distribution.sort(key=lambda item: (item["average_risk_score"], item["claims"]), reverse=True)

    return {
        "kpis": {
            "loss_ratio": round((total_payout / total_premium), 3) if total_premium else 0.0,
            "fraud_rate": round((len(flagged_claims) / len(claims)), 3) if claims else 0.0,
            "claim_volume_daily": sum(daily_counter.values()),
            "claim_volume_weekly": sum(weekly_counter.values()),
            "active_policies": len(active_policies),
            "average_payout_time_hours": avg_payout_time_hours,
            "total_premium": total_premium,
            "total_payout": total_payout,
        },
        "claims_over_time": claims_over_time,
        "city_risk_distribution": city_risk_distribution,
        "fraud_breakdown": [
            {"name": "Fraud Review", "value": len(flagged_claims)},
            {"name": "Clean Claims", "value": max(len(claims) - len(flagged_claims), 0)},
        ],
    }


def build_predictions(db: Session) -> dict:
    claims = db.query(Claim).all()
    recent_claims = [claim for claim in claims if claim.created_at and claim.created_at >= datetime.utcnow() - timedelta(days=28)]
    baseline = len(recent_claims) / 4 if recent_claims else 3
    approved = [claim for claim in recent_claims if claim.status in {"approved", "paid"}]
    avg_payout = sum(claim.payout_amount for claim in approved) / len(approved) if approved else 420

    city_scores = defaultdict(float)
    city_counts = defaultdict(int)
    for policy in db.query(Policy).filter(Policy.status == "active").all():
        if not policy.user:
            continue
        city_scores[policy.user.city] += policy.risk_score
        city_counts[policy.user.city] += 1

    high_risk_cities = []
    for city, total_score in city_scores.items():
        high_risk_cities.append(
            {
                "city": city,
                "avg_risk_score": round(total_score / city_counts[city], 3),
                "active_policies": city_counts[city],
            }
        )
    high_risk_cities.sort(key=lambda item: item["avg_risk_score"], reverse=True)

    event_counter = Counter(claim.trigger_event or "manual" for claim in recent_claims)

    return {
        "next_week_predicted_claims": int(round(baseline * 1.15)),
        "expected_payout_amount": round(avg_payout * max(baseline, 1), 2),
        "high_risk_cities": high_risk_cities[:5],
        "by_event_type": [{"event_type": event, "claims": count} for event, count in event_counter.most_common(6)],
    }


def build_dashboard_insights(db: Session, user_id: int) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {}

    active_policy = (
        db.query(Policy)
        .filter(Policy.user_id == user_id, Policy.status == "active")
        .order_by(Policy.created_at.desc())
        .first()
    )
    claims = (
        db.query(Claim)
        .filter(Claim.user_id == user_id)
        .order_by(Claim.created_at.desc())
        .limit(12)
        .all()
    )
    snapshots = (
        db.query(RiskSnapshot)
        .filter(RiskSnapshot.city == user.city)
        .order_by(RiskSnapshot.created_at.desc())
        .limit(7)
        .all()
    )

    if not snapshots:
        snapshots = [
            RiskSnapshot(city=user.city, date=datetime.utcnow().strftime("%Y-%m-%d"), risk_score=0.34, risk_level="medium", rainfall_mm=8, aqi=135, temperature=31)
        ]

    recent_notifications = []
    for notification in user.notifications[-5:]:
        recent_notifications.append(
            {
                "id": notification.id,
                "title": notification.title,
                "message": notification.message,
                "type": notification.type,
                "is_read": notification.is_read,
                "created_at": notification.created_at.isoformat() if notification.created_at else None,
            }
        )

    risk_forecast = []
    base_score = snapshots[0].risk_score if snapshots else 0.35
    for offset in range(1, 4):
        projected = min(0.95, round(base_score + (offset * 0.04), 3))
        risk_forecast.append(
            {
                "day": f"Day {offset}",
                "risk_score": projected,
                "risk_level": "high" if projected >= 0.6 else "medium" if projected >= 0.3 else "low",
            }
        )

    paid_total = sum(claim.payout_amount for claim in claims if claim.status in {"approved", "paid"})
    recommendation = "Upgrade coverage this week" if active_policy and active_policy.risk_score >= 0.6 else "Current coverage looks balanced"

    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "role": user.role,
            "city": user.city,
        },
        "active_policy": {
            "id": active_policy.id,
            "weekly_premium": active_policy.weekly_premium,
            "coverage_amount": active_policy.coverage_amount,
            "risk_level": active_policy.risk_level,
            "risk_score": active_policy.risk_score,
            "expiry": active_policy.end_date.isoformat() if active_policy and active_policy.end_date else None,
        } if active_policy else None,
        "protected_earnings_weekly": active_policy.coverage_amount if active_policy else 0.0,
        "total_payouts_collected": round(paid_total, 2),
        "risk_forecast": risk_forecast,
        "ai_recommendation": recommendation,
        "risk_trend": [
            {
                "date": snapshot.date,
                "risk_score": round(snapshot.risk_score, 3),
                "rainfall_mm": snapshot.rainfall_mm,
            }
            for snapshot in reversed(snapshots)
        ],
        "premium_vs_payout": [
            {
                "label": "Premium Paid",
                "amount": round(sum(policy.weekly_premium for policy in user.policies), 2),
            },
            {
                "label": "Payout Received",
                "amount": round(paid_total, 2),
            },
        ],
        "recent_notifications": list(reversed(recent_notifications)),
    }
