from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.rbac import Role
from ..models.ai_prep import (
    EnrollmentStatus,
    AIChatMessage,
    AIChatRole,
    AIChatSession,
    AIChatSessionStatus,
    AIStudyAction,
    Course,
    CourseStatus,
    StudentCourseEnrollment,
    StudentLearningMemory,
    Subject,
)
from ..models.user import User
from ..schemas.ai_chat_v1 import (
    AIChatMessageCreate,
    AIChatMessageOut,
    AIChatResponse,
    AIChatSessionCreate,
    AIChatSessionDetail,
    AIChatSessionOut,
    AIChatSessionUpdate,
    CourseOut,
    StudentMemoryOut,
    StudyActionOut,
    StudyActionUpdate,
    SubjectOut,
)
from ..services.llm_client import llm_client
from ..services.ai_prep_memory_service import ai_prep_memory_service

router = APIRouter(prefix="/v1", tags=["ai-chat-v1"])


def _require_student(user: User) -> None:
    if user.role != Role.student:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can access AI preparation chat")


def _session_to_out(item: AIChatSession) -> AIChatSessionOut:
    return AIChatSessionOut(
        id=item.id,
        student_id=item.student_id,
        course_id=item.course_id,
        subject_id=item.subject_id,
        title=item.title,
        mode=item.mode,
        status=item.status,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _message_to_out(item: AIChatMessage) -> AIChatMessageOut:
    return AIChatMessageOut(
        id=item.id,
        session_id=item.session_id,
        role=item.role,
        content=item.content,
        token_count=item.token_count,
        model=item.model,
        provider=item.provider,
        created_at=item.created_at,
    )


def _get_owned_session(db: Session, user: User, session_id: str) -> AIChatSession:
    row = db.query(AIChatSession).filter(AIChatSession.id == session_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    if row.student_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this chat session")
    return row


def _build_system_prompt(course: Course, subject: Subject | None) -> str:
    subject_line = subject.name if subject else "General preparation"
    syllabus = subject.syllabus if subject and subject.syllabus else "No detailed syllabus available"
    return (
        "You are an AI Preparation Agent for competitive exam prep. "
        "Stay focused on the selected course and subject. "
        "Give concise actionable plans, explain clearly, and avoid hallucinating missing syllabus facts.\n"
        f"Course: {course.name} ({course.exam_type})\n"
        f"Subject: {subject_line}\n"
        f"Syllabus context: {syllabus}"
    )


def _build_llm_messages(
    db: Session,
    user: User,
    session: AIChatSession,
    course: Course,
    subject: Subject | None,
    user_content: str,
) -> list[dict]:
    enrollment = (
        db.query(StudentCourseEnrollment)
        .filter(
            StudentCourseEnrollment.student_id == user.id,
            StudentCourseEnrollment.course_id == course.id,
            StudentCourseEnrollment.status == EnrollmentStatus.active,
        )
        .first()
    )

    memories = (
        db.query(StudentLearningMemory)
        .filter(
            StudentLearningMemory.student_id == user.id,
            StudentLearningMemory.course_id == course.id,
        )
        .order_by(StudentLearningMemory.created_at.desc())
        .limit(8)
        .all()
    )
    memory_lines = [f"- [{item.memory_type}] {item.content}" for item in memories]

    recent = (
        db.query(AIChatMessage)
        .filter(AIChatMessage.session_id == session.id)
        .order_by(AIChatMessage.created_at.desc())
        .limit(10)
        .all()
    )
    recent.reverse()

    enrollment_text = "No active enrollment details found"
    if enrollment:
        enrollment_text = (
            f"current_level={enrollment.current_level}, daily_study_time_minutes={enrollment.daily_study_time_minutes}, "
            f"target_exam_date={enrollment.target_exam_date}"
        )

    messages: list[dict] = [
        {"role": "system", "content": _build_system_prompt(course, subject)},
        {
            "role": "system",
            "content": (
                f"Student profile: email={user.email}\n"
                f"Enrollment: {enrollment_text}\n"
                f"Learning memory:\n{chr(10).join(memory_lines) if memory_lines else '- none yet'}"
            ),
        },
    ]

    for item in recent:
        role = "assistant" if item.role == AIChatRole.assistant else "user"
        if item.role not in (AIChatRole.user, AIChatRole.assistant):
            continue
        messages.append({"role": role, "content": item.content})

    messages.append({"role": "user", "content": user_content})
    return messages


@router.get("/courses", response_model=list[CourseOut])
def list_courses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_student(user)
    rows = db.query(Course).filter(Course.status == CourseStatus.active).order_by(Course.name.asc()).all()
    return [
        CourseOut(
            id=item.id,
            name=item.name,
            exam_type=item.exam_type,
            description=item.description,
            status=item.status,
        )
        for item in rows
    ]


@router.get("/courses/{course_id}/subjects", response_model=list[SubjectOut])
def list_subjects(course_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_student(user)
    course = db.query(Course).filter(Course.id == course_id, Course.status == CourseStatus.active).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    rows = db.query(Subject).filter(Subject.course_id == course_id).order_by(Subject.priority.asc(), Subject.name.asc()).all()
    return [
        SubjectOut(
            id=item.id,
            course_id=item.course_id,
            name=item.name,
            description=item.description,
            syllabus=item.syllabus,
            priority=item.priority,
        )
        for item in rows
    ]


@router.post("/ai-chat/sessions", response_model=AIChatSessionOut)
def create_chat_session(
    payload: AIChatSessionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_student(user)

    course = db.query(Course).filter(Course.id == payload.course_id, Course.status == CourseStatus.active).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    enrollment = (
        db.query(StudentCourseEnrollment)
        .filter(
            StudentCourseEnrollment.student_id == user.id,
            StudentCourseEnrollment.course_id == payload.course_id,
            StudentCourseEnrollment.status == EnrollmentStatus.active,
        )
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student is not enrolled in the selected course")

    subject = None
    if payload.subject_id:
        subject = db.query(Subject).filter(Subject.id == payload.subject_id, Subject.course_id == payload.course_id).first()
        if not subject:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Subject is not valid for selected course")

    title = payload.title.strip() if payload.title and payload.title.strip() else f"{course.name} prep"
    row = AIChatSession(
        student_id=user.id,
        course_id=payload.course_id,
        subject_id=payload.subject_id,
        title=title,
        mode=payload.mode,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _session_to_out(row)


@router.get("/ai-chat/sessions", response_model=list[AIChatSessionOut])
def list_chat_sessions(
    course_id: str | None = Query(default=None),
    subject_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_student(user)
    query = db.query(AIChatSession).filter(AIChatSession.student_id == user.id)
    if course_id:
        query = query.filter(AIChatSession.course_id == course_id)
    if subject_id:
        query = query.filter(AIChatSession.subject_id == subject_id)
    rows = query.order_by(AIChatSession.updated_at.desc()).all()
    return [_session_to_out(item) for item in rows]


@router.get("/ai-chat/sessions/{session_id}", response_model=AIChatSessionDetail)
def get_chat_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_student(user)
    session = _get_owned_session(db, user, session_id)
    messages = (
        db.query(AIChatMessage)
        .filter(AIChatMessage.session_id == session.id)
        .order_by(AIChatMessage.created_at.asc())
        .all()
    )
    return AIChatSessionDetail(session=_session_to_out(session), messages=[_message_to_out(item) for item in messages])


@router.patch("/ai-chat/sessions/{session_id}", response_model=AIChatSessionOut)
def update_chat_session(
    session_id: str,
    payload: AIChatSessionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_student(user)
    session = _get_owned_session(db, user, session_id)
    if payload.title is not None and payload.title.strip():
        session.title = payload.title.strip()
    if payload.status is not None:
        session.status = payload.status
    session.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(session)
    return _session_to_out(session)


@router.delete("/ai-chat/sessions/{session_id}")
def archive_chat_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_student(user)
    session = _get_owned_session(db, user, session_id)
    session.status = AIChatSessionStatus.archived
    session.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "session_id": session.id, "status": session.status}


@router.get("/ai-chat/sessions/{session_id}/messages", response_model=list[AIChatMessageOut])
def list_chat_messages(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_student(user)
    session = _get_owned_session(db, user, session_id)
    rows = db.query(AIChatMessage).filter(AIChatMessage.session_id == session.id).order_by(AIChatMessage.created_at.asc()).all()
    return [_message_to_out(item) for item in rows]


@router.post("/ai-chat/sessions/{session_id}/messages", response_model=AIChatResponse)
def send_chat_message(
    session_id: str,
    payload: AIChatMessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_student(user)
    session = _get_owned_session(db, user, session_id)
    if session.status != AIChatSessionStatus.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot post messages to archived session")

    course = db.query(Course).filter(Course.id == session.course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    subject = db.query(Subject).filter(Subject.id == session.subject_id).first() if session.subject_id else None

    user_message = AIChatMessage(
        session_id=session.id,
        role=AIChatRole.user,
        content=payload.content.strip(),
    )
    db.add(user_message)
    db.flush()

    llm_messages = _build_llm_messages(db, user, session, course, subject, payload.content.strip())
    completion = llm_client.chat_completion(llm_messages)

    assistant_text = ""
    if completion.choices and completion.choices[0].message:
        assistant_text = completion.choices[0].message.content or ""
    if not assistant_text:
        assistant_text = "I could not generate a response right now. Please try again."

    token_count = completion.usage.total_tokens if getattr(completion, "usage", None) else None
    model_name = completion.model if getattr(completion, "model", None) else None
    provider = "groq" if model_name and str(model_name).startswith("groq/") else "litellm"

    assistant_message = AIChatMessage(
        session_id=session.id,
        role=AIChatRole.assistant,
        content=assistant_text,
        token_count=token_count,
        model=model_name,
        provider=provider,
    )
    db.add(assistant_message)

    # POC Phase 2: lightweight memory and study-action extraction.
    ai_prep_memory_service.extract_and_store(
        db,
        user=user,
        session=session,
        user_message=payload.content.strip(),
        assistant_message=assistant_text,
    )

    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)

    return AIChatResponse(
        session_id=session.id,
        user_message=_message_to_out(user_message),
        assistant_message=_message_to_out(assistant_message),
    )


@router.get("/ai-chat/student-memory", response_model=list[StudentMemoryOut])
def list_student_memory(
    course_id: str | None = Query(default=None),
    subject_id: str | None = Query(default=None),
    memory_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_student(user)
    query = db.query(StudentLearningMemory).filter(StudentLearningMemory.student_id == user.id)
    if course_id:
        query = query.filter(StudentLearningMemory.course_id == course_id)
    if subject_id:
        query = query.filter(StudentLearningMemory.subject_id == subject_id)
    if memory_type:
        query = query.filter(StudentLearningMemory.memory_type == memory_type)
    rows = query.order_by(StudentLearningMemory.created_at.desc()).all()
    return [
        StudentMemoryOut(
            id=item.id,
            student_id=item.student_id,
            course_id=item.course_id,
            subject_id=item.subject_id,
            memory_type=item.memory_type,
            content=item.content,
            confidence_score=item.confidence_score,
            source_session_id=item.source_session_id,
            created_at=item.created_at,
        )
        for item in rows
    ]


@router.get("/ai-chat/study-actions", response_model=list[StudyActionOut])
def list_study_actions(
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    course_id: str | None = Query(default=None),
    subject_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_student(user)
    query = db.query(AIStudyAction).filter(AIStudyAction.student_id == user.id)
    if status:
        query = query.filter(AIStudyAction.status == status)
    if priority:
        query = query.filter(AIStudyAction.priority == priority)
    if course_id:
        query = query.filter(AIStudyAction.course_id == course_id)
    if subject_id:
        query = query.filter(AIStudyAction.subject_id == subject_id)
    rows = query.order_by(AIStudyAction.created_at.desc()).all()
    return [
        StudyActionOut(
            id=item.id,
            student_id=item.student_id,
            course_id=item.course_id,
            subject_id=item.subject_id,
            title=item.title,
            description=item.description,
            priority=item.priority,
            due_date=item.due_date,
            status=item.status,
            source_session_id=item.source_session_id,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in rows
    ]


@router.patch("/ai-chat/study-actions/{action_id}", response_model=StudyActionOut)
def update_study_action(
    action_id: str,
    payload: StudyActionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_student(user)
    row = db.query(AIStudyAction).filter(AIStudyAction.id == action_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study action not found")
    if row.student_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    allowed = {"pending", "in_progress", "completed", "skipped"}
    if payload.status not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    row.status = payload.status
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)

    return StudyActionOut(
        id=row.id,
        student_id=row.student_id,
        course_id=row.course_id,
        subject_id=row.subject_id,
        title=row.title,
        description=row.description,
        priority=row.priority,
        due_date=row.due_date,
        status=row.status,
        source_session_id=row.source_session_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )
