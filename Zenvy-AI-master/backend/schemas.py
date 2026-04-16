from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "food_delivery"
    city: str = "Mumbai"
    years_exp: float = 1.0
    lat: float = 19.0760
    lon: float = 72.8777
    lang: str = "en"


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    name: str
    lang: str = "en"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    city: str
    years_exp: float
    lat: float
    lon: float
    lang: str
    created_at: datetime


class RiskRequest(BaseModel):
    rainfall_mm: float = 0.0
    rainfall_7d_avg: float = 0.0
    aqi: float = 100.0
    temperature: float = 28.0
    humidity: float = 60.0
    wind_speed: float = 10.0
    hour_of_day: int = 12
    day_of_week: int = 1
    city_risk_index: float = 0.5
    historical_disruptions_30d: int = 2
    worker_years_exp: float = 1.0
    is_monsoon_season: int = 0
    is_weekend: int = 0


class RiskResponse(BaseModel):
    risk_score: float
    risk_level: str
    weekly_premium: float
    xgboost_score: float
    rf_score: float
    alert_message: Optional[str] = None
    feature_importance: dict[str, float]


class PolicyCreate(BaseModel):
    risk_score: float
    risk_level: str
    weekly_premium: float
    coverage_amount: float = 5000.0
    payment_method: str = "upi"
    payment_reference: Optional[str] = None


class PolicyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    weekly_premium: float
    coverage_amount: float
    risk_level: str
    risk_score: float
    status: str
    payment_method: str
    payment_reference: Optional[str]
    start_date: datetime
    created_at: datetime


class ClaimCreate(BaseModel):
    policy_id: int
    description: str = ""
    claim_type: str = "manual"


class ClaimOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    policy_id: int
    claim_type: str
    trigger_event: Optional[str]
    payout_amount: float
    severity: float
    duration_days: float
    status: str
    fraud_flagged: bool
    fraud_score: float
    fraud_reasons: str
    review_note: Optional[str]
    reviewed_by: Optional[int]
    reviewed_at: Optional[datetime]
    upi_transaction_id: Optional[str]
    payout_reference: Optional[str]
    payout_link: Optional[str]
    description: Optional[str]
    created_at: datetime
    paid_at: Optional[datetime]


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int]
    alert_type: str
    severity: str
    title: str
    message: str
    event_code: Optional[str]
    trigger_value: Optional[float]
    trigger_threshold: Optional[float]
    is_read: bool
    created_at: datetime


class AdminStats(BaseModel):
    total_users: int
    users_by_role: dict[str, int]
    total_policies: int
    active_policies: int
    total_claims: int
    total_payout: float
    fraud_alerts: int
    avg_risk_score: float


class TriggerRequest(BaseModel):
    event_type: str
    trigger_value: float
    city: str = "Mumbai"
    message: str = ""
    severity_override: Optional[float] = None
    duration_days: Optional[float] = None


class ClaimReviewRequest(BaseModel):
    claim_id: int
    action: str = Field(pattern="^(approved|rejected)$")
    review_note: str = ""
    reviewed_by: Optional[int] = None


class NotificationCreateRequest(BaseModel):
    user_id: int
    message: str
    type: str
    title: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PaymentInitRequest(BaseModel):
    amount: float
    purpose: str = "policy_purchase"
    user_id: int
    method: str = "upi"


class DashboardInsightsResponse(BaseModel):
    user: dict[str, Any]
    active_policy: Optional[dict[str, Any]]
    protected_earnings_weekly: float
    risk_forecast: list[dict[str, Any]]
    ai_recommendation: str
    risk_trend: list[dict[str, Any]]
    premium_vs_payout: list[dict[str, Any]]
    recent_notifications: list[dict[str, Any]]


class AdminAnalyticsResponse(BaseModel):
    kpis: dict[str, Any]
    claims_over_time: list[dict[str, Any]]
    city_risk_distribution: list[dict[str, Any]]
    fraud_breakdown: list[dict[str, Any]]


class AdminPredictionsResponse(BaseModel):
    next_week_predicted_claims: int
    expected_payout_amount: float
    high_risk_cities: list[dict[str, Any]]
    by_event_type: list[dict[str, Any]]
