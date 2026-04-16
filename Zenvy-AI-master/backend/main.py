import os
import threading
import time
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import SessionLocal, init_db
from models import User
from routes import admin, auth, claims, notifications, policy, risk
from routes.dashboard import router as dashboard_router
from routes.payments import router as payments_router
from services.platform_simulator import get_mock_platform_metrics
from services.risk_engine import train_models
from services.trigger_engine import check_platform_order_drop, check_weather_triggers


app = FastAPI(
    title="ZENVY API",
    description="AI-powered parametric insurance platform for gig workers",
    version="3.0.0",
)

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(risk.router)
app.include_router(policy.router)
app.include_router(claims.router)
app.include_router(admin.router)
app.include_router(notifications.router)
app.include_router(dashboard_router)
app.include_router(payments_router)

DEFAULT_USERS = [
    {
        "name": "Ravi Kumar",
        "email": "food@test.com",
        "password": "1234",
        "role": "food_delivery",
        "city": "Mumbai",
        "years_exp": 3.5,
        "lat": 19.0760,
        "lon": 72.8777,
        "lang": "en",
    },
    {
        "name": "Priya Singh",
        "email": "grocery@test.com",
        "password": "1234",
        "role": "grocery_delivery",
        "city": "Delhi",
        "years_exp": 2.0,
        "lat": 28.7041,
        "lon": 77.1025,
        "lang": "hi",
    },
    {
        "name": "Arun Raj",
        "email": "ecommerce@test.com",
        "password": "1234",
        "role": "ecommerce_delivery",
        "city": "Chennai",
        "years_exp": 4.0,
        "lat": 13.0827,
        "lon": 80.2707,
        "lang": "ta",
    },
    {
        "name": "Admin User",
        "email": "admin@test.com",
        "password": "1234",
        "role": "admin",
        "city": "Mumbai",
        "years_exp": 10.0,
        "lat": 19.0760,
        "lon": 72.8777,
        "lang": "en",
    },
]

_scheduler_started = False


def _seed_users():
    from routes.auth import hash_password

    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            for record in DEFAULT_USERS:
                db.add(
                    User(
                        name=record["name"],
                        email=record["email"],
                        hashed_password=hash_password(record["password"]),
                        role=record["role"],
                        city=record["city"],
                        years_exp=record["years_exp"],
                        lat=record["lat"],
                        lon=record["lon"],
                        lang=record["lang"],
                    )
                )
            db.commit()
    finally:
        db.close()


def _scheduler_loop():
    from routes.risk import fetch_weather_mock

    cities = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad"]
    interval_seconds = int(os.getenv("AUTOMATION_INTERVAL_SECONDS", "600"))
    while True:
        db = SessionLocal()
        try:
            for city in cities:
                weather = fetch_weather_mock(city)
                check_weather_triggers(weather, city, db)
                check_platform_order_drop(city, db)
                get_mock_platform_metrics(city)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
        time.sleep(interval_seconds)


@app.on_event("startup")
def startup_event():
    global _scheduler_started

    init_db()
    _seed_users()
    train_models()

    if not _scheduler_started:
        thread = threading.Thread(target=_scheduler_loop, daemon=True)
        thread.start()
        _scheduler_started = True


@app.get("/")
def root():
    return {
        "app": "ZENVY",
        "status": "running",
        "stage": "stage-3",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
