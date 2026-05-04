from datetime import date, timedelta, timezone, datetime

from sqlalchemy.orm import Session

from ..models.ai_prep import (
    AIChatSession,
    AIStudyAction,
    LearningMemoryType,
    StudentLearningMemory,
    StudyActionPriority,
    StudyActionStatus,
)
from ..models.user import User


class AIPrepMemoryService:
    def _add_memory(
        self,
        db: Session,
        *,
        user: User,
        session: AIChatSession,
        memory_type: LearningMemoryType,
        content: str,
        confidence: int,
    ) -> None:
        if not content.strip():
            return
        db.add(
            StudentLearningMemory(
                student_id=user.id,
                course_id=session.course_id,
                subject_id=session.subject_id,
                memory_type=memory_type,
                content=content.strip(),
                confidence_score=max(1, min(confidence, 100)),
                source_session_id=session.id,
            )
        )

    def _add_action(
        self,
        db: Session,
        *,
        user: User,
        session: AIChatSession,
        title: str,
        description: str,
        priority: StudyActionPriority = StudyActionPriority.medium,
        due_in_days: int = 1,
    ) -> None:
        if not title.strip():
            return
        due = date.today() + timedelta(days=max(0, due_in_days))
        db.add(
            AIStudyAction(
                student_id=user.id,
                course_id=session.course_id,
                subject_id=session.subject_id,
                title=title.strip()[:180],
                description=description.strip() if description else None,
                priority=priority,
                due_date=due,
                status=StudyActionStatus.pending,
                source_session_id=session.id,
            )
        )

    def extract_and_store(
        self,
        db: Session,
        *,
        user: User,
        session: AIChatSession,
        user_message: str,
        assistant_message: str,
    ) -> None:
        text = f"{user_message}\n{assistant_message}".lower()
        now = datetime.now(timezone.utc)

        weak_signals = ["weak", "struggle", "confused", "mistake", "wrong", "difficult"]
        goal_signals = ["goal", "target", "deadline", "complete", "finish"]
        revision_signals = ["revise", "revision", "repeat", "recall"]

        if any(token in text for token in weak_signals):
            self._add_memory(
                db,
                user=user,
                session=session,
                memory_type=LearningMemoryType.weakness,
                content=f"Session noted weakness/confusion pattern: {user_message[:240]}",
                confidence=70,
            )

        if any(token in text for token in goal_signals):
            self._add_memory(
                db,
                user=user,
                session=session,
                memory_type=LearningMemoryType.goal,
                content=f"Student goal/deadline signal: {user_message[:240]}",
                confidence=65,
            )

        if any(token in text for token in revision_signals):
            self._add_memory(
                db,
                user=user,
                session=session,
                memory_type=LearningMemoryType.revision_need,
                content=f"Revision requirement captured from session: {assistant_message[:240]}",
                confidence=60,
            )

        # Always create one actionable follow-up task per assistant response.
        title = "Review latest AI prep guidance"
        description = (
            "Convert this chat into execution: revise the discussed topic, solve 15-20 practice questions, "
            "and note top 3 mistakes before next session."
        )
        priority = StudyActionPriority.medium
        due_days = 1

        if "mock" in text or "test" in text:
            title = "Attempt one focused mock/practice set"
            description = "Attempt one timed set for the discussed topic and log errors with corrections."
            priority = StudyActionPriority.high
        elif "revision" in text or "revise" in text:
            title = "Run a spaced revision cycle"
            description = "Do two short revision blocks and self-recall checkpoints for this topic."
            priority = StudyActionPriority.high
        elif "plan" in text or "schedule" in text:
            title = "Create tomorrow's study block"
            description = "Time-box tomorrow's schedule with topic, questions, and review window."
            priority = StudyActionPriority.medium
            due_days = 0

        self._add_action(
            db,
            user=user,
            session=session,
            title=title,
            description=description,
            priority=priority,
            due_in_days=due_days,
        )

        session.updated_at = now


ai_prep_memory_service = AIPrepMemoryService()
