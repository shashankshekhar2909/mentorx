from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.database import get_db
from ..models.payment import Payment, PaymentStatus
from ..models.session import Session as MentorshipSession, SessionStatus
from ..models.session_recording import SessionRecording
from ..services.notification_service import NotificationService
from ..services.payment_service import PaymentService
from ..services.recording_service import RecordingService

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

payment_service = PaymentService()
notification_service = NotificationService()
recording_service = RecordingService()


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
                message="A class booking was confirmed after payment capture.",
                event_type="payment_confirmed",
                link_path=f"/dashboard/sessions/{session.id}",
            )
    db.commit()

    return {"message": "Webhook processed"}


@router.post("/livekit/egress")
async def livekit_egress_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_livekit_api_key: str | None = Header(default=None),
):
    if x_livekit_api_key and x_livekit_api_key != settings.livekit_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid LiveKit webhook key")

    payload = await request.json()
    egress_id = payload.get("egress_id") or payload.get("egressId")
    status_value = payload.get("status")
    file_results = payload.get("file_results") or payload.get("fileResults") or []
    if not egress_id:
        return {"message": "Ignored event"}

    row = db.query(SessionRecording).filter(SessionRecording.egress_id == str(egress_id)).first()
    if not row:
        return {"message": "Ignored unknown egress"}

    session = db.query(MentorshipSession).filter(MentorshipSession.id == row.session_id).first()
    if not session:
        return {"message": "Ignored missing session"}

    normalized_status = str(status_value).lower()
    if "complete" in normalized_status:
        object_key = None
        if isinstance(file_results, list) and file_results:
            first = file_results[0] or {}
            object_key = first.get("filename") or first.get("filepath")
        object_key = object_key or row.object_key or f"recordings/{session.id}/session-{row.attempt_number}.mp4"
        recording_service.mark_uploaded(db, session.id, object_key, recording_id=row.id)
        if session.status == SessionStatus.in_progress:
            session.status = SessionStatus.completed
            db.commit()
    elif "fail" in normalized_status or "abort" in normalized_status or "limit" in normalized_status:
        recording_service.mark_failed(db, session.id, "LiveKit egress reported failure", recording_id=row.id)
    else:
        row.error_message = f"Egress update received: {status_value}"
        db.commit()

    return {"message": "LiveKit egress event processed"}
