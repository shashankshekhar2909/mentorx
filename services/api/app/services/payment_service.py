import hashlib
import hmac
from uuid import uuid4

from ..core.config import settings


class PaymentService:
    def create_order(self, amount: float, currency: str = "INR") -> dict[str, str | float]:
        # MVP-safe placeholder order creation. Replace with Razorpay SDK call in production.
        return {
            "provider": "razorpay",
            "provider_order_id": f"order_{uuid4().hex[:24]}",
            "amount": amount,
            "currency": currency,
            "key_id": settings.razorpay_key_id or "",
        }

    def verify_webhook(self, body: bytes, signature: str | None) -> bool:
        secret = settings.razorpay_webhook_secret
        if not secret or not signature:
            return False
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
