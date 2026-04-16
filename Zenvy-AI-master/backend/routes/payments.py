from fastapi import APIRouter

from schemas import PaymentInitRequest
from services.payments import build_payment_payload

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/initiate")
def initiate_payment(req: PaymentInitRequest):
    return build_payment_payload(
        amount=req.amount,
        purpose=req.purpose,
        user_id=req.user_id,
        method=req.method,
    )
