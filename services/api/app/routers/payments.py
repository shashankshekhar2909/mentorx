from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.rbac import Role
from ..models.payment import Payment, PaymentStatus
from ..models.session import Session as MentorshipSession, SessionStatus
from ..models.user import User
from ..schemas.payment import PaymentOrderRequest, PaymentOrderResponse, PaymentVerifyRequest
from ..services.notification_service import NotificationService
from ..services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["payments"])

payment_service = PaymentService()
notification_service = NotificationService()


@router.post("/order", response_model=PaymentOrderResponse)
def create_payment_order(
    payload: PaymentOrderRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = db.query(MentorshipSession).filter(MentorshipSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if user.role != Role.admin and session.student_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only booking student can pay")

    order = payment_service.create_order(payload.amount)
    payment = Payment(
        session_id=session.id,
        payer_id=user.id,
        provider_order_id=str(order["provider_order_id"]),
        amount=payload.amount,
        status=PaymentStatus.created,
    )
    db.add(payment)
    session.status = SessionStatus.pending_payment
    db.commit()

    return PaymentOrderResponse(**order)


@router.post("/verify")
def verify_payment(
    payload: PaymentVerifyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payment = db.query(Payment).filter(Payment.provider_order_id == payload.provider_order_id).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment order not found")

    session = db.query(MentorshipSession).filter(MentorshipSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    if user.role != Role.admin and session.student_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    payment.status = PaymentStatus.paid
    session.status = SessionStatus.confirmed
    db.commit()

    notification_service.create(
        db,
        user_id=session.mentor_id,
        title="New confirmed booking",
        message=f"Session {session.id} has been paid and confirmed.",
    )

    return {"message": "Payment verified and session confirmed"}
