from pydantic import BaseModel, Field

from ..models.payment import PaymentStatus


class PaymentOrderRequest(BaseModel):
    session_id: str
    amount: float = Field(gt=0)


class PaymentOrderResponse(BaseModel):
    provider: str
    provider_order_id: str
    amount: float
    currency: str
    key_id: str


class PaymentVerifyRequest(BaseModel):
    session_id: str
    provider_payment_id: str
    provider_order_id: str
    signature: str


class PaymentOut(BaseModel):
    id: str
    session_id: str | None
    amount: float
    status: PaymentStatus
    provider_order_id: str | None
