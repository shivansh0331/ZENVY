from __future__ import annotations

from datetime import datetime


CITY_BASELINES = {
    "Mumbai": 1200,
    "Delhi": 950,
    "Bangalore": 900,
    "Chennai": 760,
    "Hyderabad": 840,
    "Kolkata": 700,
}


def get_mock_platform_metrics(city: str) -> dict:
    baseline = CITY_BASELINES.get(city, 800)
    hour = datetime.utcnow().hour
    cycle_adjustment = 0.65 if hour < 8 else 1.0 if hour < 20 else 0.82
    current_orders = int(baseline * cycle_adjustment)
    previous_orders = baseline
    order_drop_pct = max(0.0, round((1 - (current_orders / previous_orders)) * 100, 2))
    return {
        "city": city,
        "current_orders": current_orders,
        "previous_orders": previous_orders,
        "order_drop_pct": order_drop_pct,
        "threshold_breached": order_drop_pct >= 60,
    }
