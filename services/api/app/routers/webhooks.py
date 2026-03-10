from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.payment import Payment, PaymentStatus
from ..models.session import Session as MentorshipSession, SessionStatus
from ..services.notification_service import NotificationService
from ..services.payment_service import PaymentService

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

payment_service = PaymentService()
notification_service = NotificationService()


@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_razorpay_signature: str | None = Header(default=None),
):
    body = await request.body()
    if not payment_service.verify_webhook(body, x_razorpay_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    payload = await request.json()
    order_id = payload.get("payload", {}).get("payment", {}).get("entity", {}).get("order_id")
    if not order_id:
        return {"message": "Ignored event"}

    payment = db.query(Payment).filter(Payment.provider_order_id == order_id).first()
    if not payment:
        return {"message": "Ignored unknown order"}

    payment.status = PaymentStatus.paid
    if payment.session_id:
        session = db.query(MentorshipSession).filter(MentorshipSession.id == payment.session_id).first()
        if session:
            session.status = SessionStatus.confirmed
            notification_service.create(
                db,
                user_id=session.mentor_id,
                title="Booking confirmed via webhook",
                message=f"Session {session.id} is confirmed after webhook payment capture.",
            )
    db.commit()

    return {"message": "Webhook processed"}
