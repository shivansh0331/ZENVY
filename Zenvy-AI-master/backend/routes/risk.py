import os
from datetime import datetime

import requests
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import RiskSnapshot
from schemas import RiskRequest, RiskResponse
from services.platform_simulator import get_mock_platform_metrics
from services.risk_engine import predict_risk
from services.trigger_engine import check_platform_order_drop, check_weather_triggers

router = APIRouter(prefix="/risk", tags=["Risk"])

OWM_API_KEY = os.getenv("OWM_API_KEY", "")


def fetch_weather_mock(city: str) -> dict:
    import random

    rain = random.uniform(0, 30)
    return {
        "rainfall_mm": round(rain, 2),
        "rainfall_7d_avg": round(rain * 0.6, 2),
        "aqi": round(random.uniform(50, 350), 1),
        "temperature": round(random.uniform(24, 44), 1),
        "humidity": round(random.uniform(40, 95), 1),
        "wind_speed": round(random.uniform(5, 40), 1),
        "hour_of_day": datetime.utcnow().hour,
        "day_of_week": datetime.utcnow().weekday(),
        "city_risk_index": 0.6,
        "is_monsoon_season": 1 if datetime.utcnow().month in [6, 7, 8, 9] else 0,
        "is_weekend": 1 if datetime.utcnow().weekday() >= 5 else 0,
        "historical_disruptions_30d": random.randint(1, 8),
    }


def fetch_weather_live(city: str) -> dict:
    try:
        response = requests.get(
            f"http://api.openweathermap.org/data/2.5/weather?q={city},IN&appid={OWM_API_KEY}&units=metric",
            timeout=5,
        )
        data = response.json()
        rain = data.get("rain", {}).get("1h", 0.0)
        return {
            "rainfall_mm": rain,
            "rainfall_7d_avg": rain * 0.7,
            "aqi": 150.0,
            "temperature": data["main"]["temp"],
            "humidity": data["main"]["humidity"],
            "wind_speed": data["wind"]["speed"],
            "hour_of_day": datetime.utcnow().hour,
            "day_of_week": datetime.utcnow().weekday(),
            "city_risk_index": 0.6,
            "is_monsoon_season": 1 if datetime.utcnow().month in [6, 7, 8, 9] else 0,
            "is_weekend": 1 if datetime.utcnow().weekday() >= 5 else 0,
            "historical_disruptions_30d": 3,
        }
    except Exception:
        return fetch_weather_mock(city)


@router.post("/assess", response_model=RiskResponse)
def assess_risk(req: RiskRequest, role: str = Query("food_delivery"), db: Session = Depends(get_db)):
    result = predict_risk(req.model_dump(), role=role)
    db.add(
        RiskSnapshot(
            city="Mumbai",
            date=datetime.utcnow().strftime("%Y-%m-%d"),
            risk_score=result["risk_score"],
            risk_level=result["risk_level"],
            rainfall_mm=req.rainfall_mm,
            aqi=req.aqi,
            temperature=req.temperature,
        )
    )
    db.commit()
    return result


@router.get("/weather/{city}")
def get_weather_risk(city: str, role: str = Query("food_delivery"), db: Session = Depends(get_db)):
    weather = fetch_weather_live(city) if OWM_API_KEY else fetch_weather_mock(city)
    result = predict_risk(weather, role=role)

    snapshot = RiskSnapshot(
        city=city,
        date=datetime.utcnow().strftime("%Y-%m-%d"),
        risk_score=result["risk_score"],
        risk_level=result["risk_level"],
        rainfall_mm=weather["rainfall_mm"],
        aqi=weather["aqi"],
        temperature=weather["temperature"],
    )
    db.add(snapshot)
    db.commit()

    triggered_weather = check_weather_triggers(weather, city, db)
    triggered_platform = check_platform_order_drop(city, db)
    platform_metrics = get_mock_platform_metrics(city)

    return {
        "city": city,
        "weather": weather,
        "risk": result,
        "automation": {
            "weather_events": triggered_weather,
            "platform_event": triggered_platform,
            "platform_metrics": platform_metrics,
        },
    }


@router.get("/snapshots")
def get_risk_snapshots(city: str = "Mumbai", limit: int = 30, db: Session = Depends(get_db)):
    snapshots = (
        db.query(RiskSnapshot)
        .filter(RiskSnapshot.city == city)
        .order_by(RiskSnapshot.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "date": snapshot.date,
            "risk_score": round(snapshot.risk_score, 3),
            "risk_level": snapshot.risk_level,
            "rainfall_mm": snapshot.rainfall_mm,
            "aqi": snapshot.aqi,
            "temperature": snapshot.temperature,
        }
        for snapshot in reversed(snapshots)
    ]
