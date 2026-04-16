from __future__ import annotations

import uuid
from datetime import datetime


def generate_payment_reference(prefix: str = "ZPAY") -> str:
    return f"{prefix}{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{str(uuid.uuid4())[:6].upper()}"


def build_upi_deep_link(amount: float, payee_name: str = "Zenvy", upi_id: str = "test@upi") -> str:
    return f"upi://pay?pa={upi_id}&pn={payee_name}&am={round(amount, 2)}&cu=INR"


def build_payment_payload(amount: float, purpose: str, user_id: int, method: str = "upi") -> dict:
    reference = generate_payment_reference("ZP")
    return {
        "transaction_id": reference,
        "method": method,
        "purpose": purpose,
        "user_id": user_id,
        "amount": round(amount, 2),
        "status": "success",
        "upi_link": build_upi_deep_link(amount),
        "razorpay_order_id": f"order_{reference.lower()}",
    }
