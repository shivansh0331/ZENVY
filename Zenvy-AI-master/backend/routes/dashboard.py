from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import DashboardInsightsResponse
from services.analytics import build_dashboard_insights

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/insights", response_model=DashboardInsightsResponse)
def get_dashboard_insights(user_id: int, db: Session = Depends(get_db)):
    if not db.query(User).filter(User.id == user_id).first():
        raise HTTPException(status_code=404, detail="User not found")
    return build_dashboard_insights(db, user_id)
