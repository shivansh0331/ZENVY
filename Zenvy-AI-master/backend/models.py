from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="food_delivery")
    city = Column(String, default="Mumbai")
    years_exp = Column(Float, default=1.0)
    lat = Column(Float, default=19.0760)
    lon = Column(Float, default=72.8777)
    lang = Column(String, default="en")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    policies = relationship("Policy", back_populates="user")


class Policy(Base):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    weekly_premium = Column(Float, nullable=False)
    coverage_amount = Column(Float, nullable=False)
    risk_level = Column(String, default="low")
    risk_score = Column(Float, default=0.0)
    status = Column(String, default="active")
    payment_method = Column(String, default="upi")
    payment_reference = Column(String, nullable=True)
    start_date = Column(DateTime, server_default=func.now())
    end_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="policies")
    claims = relationship("Claim", back_populates="policy")


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    policy_id = Column(Integer, ForeignKey("policies.id"))
    claim_type = Column(String, default="parametric")
    trigger_event = Column(String, nullable=True)
    payout_amount = Column(Float, default=0.0)
    severity = Column(Float, default=0.5)
    duration_days = Column(Float, default=1.0)
    status = Column(String, default="pending")
    fraud_flagged = Column(Boolean, default=False)
    fraud_score = Column(Float, default=0.0)
    fraud_reasons = Column(Text, default="[]")
    review_note = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    processing_started_at = Column(DateTime, nullable=True)
    upi_transaction_id = Column(String, nullable=True)
    payout_reference = Column(String, nullable=True)
    payout_link = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    event_metadata = Column(Text, default="{}")
    created_at = Column(DateTime, server_default=func.now())
    paid_at = Column(DateTime, nullable=True)

    user = relationship("User", primaryjoin="Claim.user_id==User.id")
    policy = relationship("Policy")
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    alert_type = Column(String, nullable=False)
    severity = Column(String, default="warning")
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    event_code = Column(String, nullable=True)
    trigger_value = Column(Float, nullable=True)
    trigger_threshold = Column(Float, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", primaryjoin="Alert.user_id==User.id")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=True)
    message = Column(Text, nullable=False)
    type = Column(String, nullable=False)
    metadata_json = Column(Text, default="{}")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", primaryjoin="Notification.user_id==User.id")


class RiskSnapshot(Base):
    __tablename__ = "risk_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    city = Column(String, default="Mumbai")
    date = Column(String, nullable=False)
    risk_score = Column(Float, default=0.0)
    risk_level = Column(String, default="low")
    rainfall_mm = Column(Float, default=0.0)
    aqi = Column(Float, default=100.0)
    temperature = Column(Float, default=28.0)
    created_at = Column(DateTime, server_default=func.now())
