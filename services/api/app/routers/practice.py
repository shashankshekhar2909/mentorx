from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.deps import get_current_user
from ..core.rbac import Role
from ..models.category import Category
from ..models.manager_scope import ManagerScope
from ..models.practice_test import PracticeAttempt, PracticeAttemptAnswer, PracticeQuestion, PracticeTest
from ..models.user import User
from ..schemas.practice import (
    PracticeAttemptHistoryItem,
    PracticeAttemptResult,
    PracticeAttemptSubmit,
    PracticeQuestionOut,
    PracticeTestCreate,
    PracticeTestDetail,
    PracticeTestListItem,
    PracticeTestUpdate,
)

router = APIRouter(prefix="/practice-tests", tags=["practice-tests"])


def _parse_categories_csv(value: str | None) -> set[str]:
    return {item.strip().lower() for item in (value or "").split(",") if item.strip()}


def _question_out(question: PracticeQuestion, include_answers: bool) -> PracticeQuestionOut:
    return PracticeQuestionOut(
        id=question.id,
        prompt=question.prompt,
        option_a=question.option_a,
        option_b=question.option_b,
        option_c=question.option_c,
        option_d=question.option_d,
        position=question.position,
        is_active=question.is_active,
        correct_option=question.correct_option if include_answers else None,
        explanation=question.explanation if include_answers else None,
    )


def _get_author_scope(user: User, db: Session) -> set[str] | None:
    if user.role == Role.admin:
        return None
    if user.role == Role.manager:
        row = db.query(ManagerScope).filter(ManagerScope.user_id == user.id).first()
        return _parse_categories_csv(row.categories_csv if row else "")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager/admin only")


def _can_view_test(user: User, row: PracticeTest, db: Session) -> bool:
    if user.role in (Role.admin, Role.manager):
        scope = _get_author_scope(user, db)
        if scope is None:
            return True
        category = db.query(Category).filter(Category.id == row.category_id).first()
        return bool(category and category.slug.lower() in scope)
    return row.is_active and row.is_published


def _attempt_summary(attempts: list[PracticeAttempt]) -> tuple[int, float | None, float | None]:
    if not attempts:
        return 0, None, None
    ordered = sorted(attempts, key=lambda item: item.submitted_at, reverse=True)
    best = max(item.percentage for item in attempts)
    latest = ordered[0].percentage
    return len(attempts), best, latest


def _build_list_item(row: PracticeTest, category: Category, attempts: list[PracticeAttempt]) -> PracticeTestListItem:
    attempt_count, best, latest = _attempt_summary(attempts)
    return PracticeTestListItem(
        id=row.id,
        category_id=category.id,
        category_name=category.name,
        category_slug=category.slug,
        title=row.title,
        description=row.description,
        is_active=row.is_active,
        is_published=row.is_published,
        question_count=row.question_count,
        created_at=row.created_at,
        updated_at=row.updated_at,
        my_attempt_count=attempt_count,
        my_best_percentage=best,
        my_latest_percentage=latest,
    )


def _upsert_questions(db: Session, test_id: str, payload_questions: list) -> int:
    existing_rows = {row.id: row for row in db.query(PracticeQuestion).filter(PracticeQuestion.test_id == test_id).all()}
    seen_existing_ids: set[str] = set()

    for item in payload_questions:
        if item.id and item.id in existing_rows:
            row = existing_rows[item.id]
            seen_existing_ids.add(item.id)
        else:
            row = PracticeQuestion(test_id=test_id)
            db.add(row)
        row.prompt = item.prompt.strip()
        row.option_a = item.option_a.strip()
        row.option_b = item.option_b.strip()
        row.option_c = item.option_c.strip()
        row.option_d = item.option_d.strip()
        row.correct_option = item.correct_option.strip().upper()
        row.explanation = item.explanation.strip() if item.explanation and item.explanation.strip() else None
        row.position = item.position
        row.is_active = item.is_active

    for row_id, row in existing_rows.items():
        if row_id not in seen_existing_ids:
            row.is_active = False

    return sum(1 for item in payload_questions if item.is_active)


@router.get("", response_model=list[PracticeTestListItem])
def list_practice_tests(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tests = db.query(PracticeTest).order_by(PracticeTest.updated_at.desc(), PracticeTest.created_at.desc()).all()
    category_rows = {row.id: row for row in db.query(Category).all()}
    attempts = (
        db.query(PracticeAttempt)
        .filter(PracticeAttempt.student_user_id == user.id)
        .order_by(PracticeAttempt.submitted_at.desc())
        .all()
    )
    attempts_by_test: dict[str, list[PracticeAttempt]] = {}
    for item in attempts:
        attempts_by_test.setdefault(item.test_id, []).append(item)

    items: list[PracticeTestListItem] = []
    for row in tests:
        category = category_rows.get(row.category_id)
        if not category:
            continue
        if active_only and not row.is_active:
            continue
        if not _can_view_test(user, row, db):
            continue
        if user.role not in (Role.admin, Role.manager) and not row.is_published:
            continue
        items.append(_build_list_item(row, category, attempts_by_test.get(row.id, [])))
    return items


@router.get("/{test_id}", response_model=PracticeTestDetail)
def get_practice_test(
    test_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.query(PracticeTest).filter(PracticeTest.id == test_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice test not found")
    if not _can_view_test(user, row, db):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice test not found")

    category = db.query(Category).filter(Category.id == row.category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    include_answers = user.role in (Role.admin, Role.manager)
    questions_query = db.query(PracticeQuestion).filter(PracticeQuestion.test_id == row.id)
    if not include_answers:
        questions_query = questions_query.filter(PracticeQuestion.is_active == True)  # noqa: E712
    questions = questions_query.order_by(PracticeQuestion.position.asc()).all()

    attempts = (
        db.query(PracticeAttempt)
        .filter(PracticeAttempt.test_id == row.id, PracticeAttempt.student_user_id == user.id)
        .order_by(PracticeAttempt.submitted_at.desc())
        .all()
    )
    attempt_count, best, latest = _attempt_summary(attempts)

    return PracticeTestDetail(
        id=row.id,
        category_id=category.id,
        category_name=category.name,
        category_slug=category.slug,
        title=row.title,
        description=row.description,
        is_active=row.is_active,
        is_published=row.is_published,
        question_count=row.question_count,
        questions=[_question_out(question, include_answers) for question in questions],
        my_attempt_count=attempt_count,
        my_best_percentage=best,
        my_latest_percentage=latest,
        attempts=[
            PracticeAttemptHistoryItem(
                id=item.id,
                score=item.score,
                total_questions=item.total_questions,
                percentage=item.percentage,
                submitted_at=item.submitted_at,
            )
            for item in attempts[:10]
        ],
    )


@router.post("", response_model=PracticeTestDetail)
def create_practice_test(
    payload: PracticeTestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    scope = _get_author_scope(user, db)
    category = db.query(Category).filter(Category.id == payload.category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category not found")
    if scope is not None and category.slug.lower() not in scope:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager can create tests only within assigned categories")

    row = PracticeTest(
        category_id=payload.category_id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description and payload.description.strip() else None,
        created_by_user_id=user.id,
        is_active=payload.is_active,
        is_published=payload.is_published,
    )
    db.add(row)
    db.flush()
    row.question_count = _upsert_questions(db, row.id, payload.questions)
    if row.is_published and row.question_count <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Published tests need at least one active question")
    db.commit()
    return get_practice_test(row.id, db, user)


@router.put("/{test_id}", response_model=PracticeTestDetail)
def update_practice_test(
    test_id: str,
    payload: PracticeTestUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.query(PracticeTest).filter(PracticeTest.id == test_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice test not found")

    scope = _get_author_scope(user, db)
    current_category = db.query(Category).filter(Category.id == row.category_id).first()
    next_category = db.query(Category).filter(Category.id == payload.category_id).first()
    if not next_category:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category not found")
    if scope is not None:
        current_slug = current_category.slug.lower() if current_category else ""
        next_slug = next_category.slug.lower()
        if current_slug not in scope or next_slug not in scope:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager can update tests only within assigned categories")

    row.category_id = payload.category_id
    row.title = payload.title.strip()
    row.description = payload.description.strip() if payload.description and payload.description.strip() else None
    row.is_active = payload.is_active
    row.is_published = payload.is_published
    row.updated_at = datetime.now(timezone.utc)
    if payload.questions is not None:
        row.question_count = _upsert_questions(db, row.id, payload.questions)
    if row.is_published and row.question_count <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Published tests need at least one active question")
    db.commit()
    return get_practice_test(row.id, db, user)


@router.post("/{test_id}/publish", response_model=PracticeTestDetail)
def publish_practice_test(
    test_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.query(PracticeTest).filter(PracticeTest.id == test_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice test not found")
    scope = _get_author_scope(user, db)
    category = db.query(Category).filter(Category.id == row.category_id).first()
    if scope is not None and category and category.slug.lower() not in scope:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager can publish tests only within assigned categories")
    active_question_count = (
        db.query(PracticeQuestion)
        .filter(PracticeQuestion.test_id == row.id, PracticeQuestion.is_active == True)  # noqa: E712
        .count()
    )
    if active_question_count <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Published tests need at least one active question")
    row.is_published = True
    row.question_count = active_question_count
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    return get_practice_test(row.id, db, user)


@router.get("/{test_id}/attempts/mine", response_model=list[PracticeAttemptHistoryItem])
def list_my_attempts(
    test_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.query(PracticeTest).filter(PracticeTest.id == test_id).first()
    if not row or not _can_view_test(user, row, db):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice test not found")
    attempts = (
        db.query(PracticeAttempt)
        .filter(PracticeAttempt.test_id == test_id, PracticeAttempt.student_user_id == user.id)
        .order_by(PracticeAttempt.submitted_at.desc())
        .all()
    )
    return [
        PracticeAttemptHistoryItem(
            id=item.id,
            score=item.score,
            total_questions=item.total_questions,
            percentage=item.percentage,
            submitted_at=item.submitted_at,
        )
        for item in attempts
    ]


@router.post("/{test_id}/attempts", response_model=PracticeAttemptResult)
def submit_attempt(
    test_id: str,
    payload: PracticeAttemptSubmit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.query(PracticeTest).filter(PracticeTest.id == test_id).first()
    if not row or not row.is_active or not row.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Practice test not found")

    questions = (
        db.query(PracticeQuestion)
        .filter(PracticeQuestion.test_id == row.id, PracticeQuestion.is_active == True)  # noqa: E712
        .order_by(PracticeQuestion.position.asc())
        .all()
    )
    if not questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Practice test has no active questions")

    answers_by_question = {item.question_id: item.selected_option for item in payload.answers}
    question_ids = {item.id for item in questions}
    if not set(answers_by_question.keys()).issubset(question_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attempt contains answers for unknown questions")

    prior_attempts = (
        db.query(PracticeAttempt)
        .filter(PracticeAttempt.test_id == row.id, PracticeAttempt.student_user_id == user.id)
        .order_by(PracticeAttempt.submitted_at.desc())
        .all()
    )
    previous_percentage = prior_attempts[0].percentage if prior_attempts else None

    attempt = PracticeAttempt(
        test_id=row.id,
        student_user_id=user.id,
        total_questions=len(questions),
        started_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    db.flush()

    score = 0
    answer_results = []
    for question in questions:
        selected_option = answers_by_question.get(question.id)
        is_correct = selected_option == question.correct_option
        if is_correct:
            score += 1
        db.add(
            PracticeAttemptAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                selected_option=selected_option,
                is_correct=is_correct,
            )
        )
        answer_results.append(
            {
                "question_id": question.id,
                "selected_option": selected_option,
                "correct_option": question.correct_option,
                "is_correct": is_correct,
                "explanation": question.explanation,
            }
        )

    percentage = round((score / len(questions)) * 100, 2) if questions else 0
    attempt.score = score
    attempt.percentage = percentage
    db.commit()

    best_percentage = max([percentage, *[item.percentage for item in prior_attempts]]) if prior_attempts else percentage
    return PracticeAttemptResult(
        attempt_id=attempt.id,
        score=score,
        total_questions=len(questions),
        percentage=percentage,
        previous_percentage=previous_percentage,
        best_percentage=best_percentage,
        answers=answer_results,
    )
