from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..models.mentor_profile import MentorProfile, MentorVerificationStatus
from ..models.user import User
from ..schemas.ai import StudyPlanRequest, StudyPlanResponse
from ..services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["ai"])

ai_service = AIService()


@router.post("/study-plan", response_model=StudyPlanResponse)
def build_study_plan(payload: StudyPlanRequest, user: User = Depends(get_current_user)):
    return ai_service.build_study_plan(payload, user.email)


@router.get("/mentor-recommendations")
def mentor_recommendations(
    exam: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(MentorProfile)
        .filter(MentorProfile.verification_status == MentorVerificationStatus.approved)
        .filter(MentorProfile.exams.contains(exam))
        .order_by(MentorProfile.rating_avg.desc(), MentorProfile.years_experience.desc())
        .limit(5)
        .all()
    )
    return {
        "for_user": user.email,
        "exam": exam,
        "recommendations": [
            {
                "mentor_user_id": row.user_id,
                "headline": row.headline,
                "rating_avg": float(row.rating_avg),
                "hourly_price": float(row.hourly_price),
                "reason": "Matched on exam focus and mentor quality signals",
            }
            for row in rows
        ],
    }
