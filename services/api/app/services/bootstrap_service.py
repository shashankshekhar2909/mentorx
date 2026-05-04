from sqlalchemy.orm import Session
from sqlalchemy import text

from ..core.config import settings
from ..core.rbac import Role
from ..core.security import hash_password
from ..models.category import Category
from ..models.ai_prep import Course, CourseStatus, CurrentLevel, EnrollmentStatus, StudentCourseEnrollment, Subject
from ..models.mentor_profile import MentorProfile, MentorVerificationStatus
from ..models.practice_test import PracticeQuestion, PracticeTest
from ..models.profile import Profile
from ..models.user import User
from .storage_service import StorageService


DEFAULT_PASSWORD = "Test@7861"

DEFAULT_USERS = [
    ("student.demo@exammentor.com", Role.student),
    ("mentor.demo@exammentor.com", Role.mentor),
    ("manager.demo@exammentor.com", Role.manager),
    ("admin.demo@exammentor.com", Role.admin),
]

DEFAULT_CATEGORIES = [
    ("UPSC CSE", "upsc-cse"),
    ("JEE Main & Advanced", "jee-main-advanced"),
    ("NEET UG", "neet-ug"),
    ("GATE", "gate"),
    ("CAT", "cat"),
]

DEFAULT_STUDENT_EXAMS = ",".join(slug for _, slug in DEFAULT_CATEGORIES)
DEFAULT_MENTOR_EXAMS = "gate"

DEFAULT_PRACTICE_QUESTION_TEMPLATES = [
    {
        "prompt": "During {category} preparation, what should you do first after finishing a mock test?",
        "options": (
            "Start a new mock immediately without reviewing mistakes",
            "Review errors, classify weak areas, and revise those topics",
            "Skip analysis and only note the final score",
            "Change all study material at once",
        ),
        "correct": "B",
        "explanation": "Mock analysis is most useful when it turns mistakes into targeted revision and action items.",
    },
    {
        "prompt": "What is the best reason to maintain a revision tracker for {category} topics?",
        "options": (
            "To increase the number of books you own",
            "To avoid solving any questions twice",
            "To identify which topics have been revised and which still need attention",
            "To memorize the timetable only once",
        ),
        "correct": "C",
        "explanation": "A revision tracker gives visibility into coverage and helps schedule high-value revision cycles.",
    },
    {
        "prompt": "If accuracy is dropping in {category} practice, what is the strongest corrective step?",
        "options": (
            "Increase speed further on every question",
            "Review incorrect patterns and slow down on weak question types",
            "Ignore accuracy and focus only on total attempts",
            "Switch subjects every hour regardless of performance",
        ),
        "correct": "B",
        "explanation": "Accuracy usually improves when recurring mistakes are reviewed and weak patterns are handled deliberately.",
    },
    {
        "prompt": "Why should a student mix timed practice with concept revision for {category}?",
        "options": (
            "Because timing and conceptual recall both affect exam performance",
            "Because timed practice removes the need for concept study",
            "Because revision is useful only after the exam",
            "Because concept study should happen only on weekends",
        ),
        "correct": "A",
        "explanation": "Competitive exams reward both conceptual clarity and execution under time pressure.",
    },
    {
        "prompt": "What is the best use of mentor feedback after a difficult {category} session?",
        "options": (
            "Store it without changing the study plan",
            "Convert it into specific next actions for practice and revision",
            "Wait until the next month to think about it",
            "Use it only if it matches the easiest topic",
        ),
        "correct": "B",
        "explanation": "Feedback matters only when it becomes concrete follow-up work in the study plan.",
    },
    {
        "prompt": "A student is repeatedly forgetting solved concepts in {category}. What should they prioritize?",
        "options": (
            "A spaced revision cycle with short recall sessions",
            "Buying more books without revising notes",
            "Attempting only brand-new chapters",
            "Avoiding mock tests until the final month",
        ),
        "correct": "A",
        "explanation": "Spaced recall reduces forgetting and improves long-term retention of solved concepts.",
    },
    {
        "prompt": "Which signal best shows that a {category} topic needs more practice?",
        "options": (
            "You like the chapter title",
            "You answer correctly only when solutions are visible",
            "You studied it once last month",
            "It appears early in the syllabus",
        ),
        "correct": "B",
        "explanation": "Real mastery shows up when you can solve accurately without depending on the solution.",
    },
    {
        "prompt": "What is the most useful way to split a 2-hour {category} study block?",
        "options": (
            "Two hours of passive reading only",
            "A mix of concept review, targeted questions, and short mistake analysis",
            "Randomly switch topics every ten minutes",
            "Spend the whole time organizing folders",
        ),
        "correct": "B",
        "explanation": "Balanced blocks combine learning, application, and feedback instead of passive time spending.",
    },
    {
        "prompt": "Why is attempt history valuable in a {category} practice-test module?",
        "options": (
            "It helps compare performance across repeated attempts",
            "It removes the need for explanation review",
            "It guarantees exam rank improvement automatically",
            "It replaces mentorship completely",
        ),
        "correct": "A",
        "explanation": "History makes progress visible and helps students judge whether revision is working over time.",
    },
    {
        "prompt": "Before the next {category} test, what should a student do with topics that repeatedly go wrong?",
        "options": (
            "Ignore them and hope they disappear from the paper",
            "Tag them as priority weak areas and revise their solving pattern",
            "Delete related notes to reduce pressure",
            "Attempt fewer questions from those topics forever",
        ),
        "correct": "B",
        "explanation": "Weak areas need focused review, not avoidance, before the next timed attempt.",
    },
]


def seed_default_users(db: Session) -> None:
    # SQLite-safe column backfill for evolving MVP schema.
    try:
        columns = db.execute(text("PRAGMA table_info(resources)")).fetchall()
        existing = {str(row[1]) for row in columns}
        if "is_active" not in existing:
            db.execute(text("ALTER TABLE resources ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"))
        if "is_deleted" not in existing:
            db.execute(text("ALTER TABLE resources ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT 0"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        columns = db.execute(text("PRAGMA table_info(session_recordings)")).fetchall()
        existing = {str(row[1]) for row in columns}
        create_sql_row = db.execute(
            text("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'session_recordings'")
        ).fetchone()
        create_sql = str(create_sql_row[0]).lower() if create_sql_row and create_sql_row[0] else ""
        needs_rebuild = bool(columns) and (
            "attempt_number" not in existing
            or "created_at" not in existing
            or "unique (session_id)" in create_sql
            or "session_id varchar(36) not null, unique" in create_sql
        )
        if needs_rebuild:
            db.execute(text("DROP TABLE IF EXISTS session_recordings_new"))
            db.execute(
                text(
                    """
                    CREATE TABLE session_recordings_new (
                        id VARCHAR(36) NOT NULL PRIMARY KEY,
                        session_id VARCHAR(36) NOT NULL,
                        attempt_number INTEGER NOT NULL DEFAULT 1,
                        egress_id VARCHAR(128),
                        object_key VARCHAR(255),
                        playback_url VARCHAR(255),
                        status VARCHAR(16) NOT NULL,
                        error_message TEXT,
                        created_at DATETIME,
                        deleted_at DATETIME,
                        deleted_by_user_id VARCHAR(36),
                        updated_at DATETIME,
                        FOREIGN KEY(session_id) REFERENCES sessions (id),
                        FOREIGN KEY(deleted_by_user_id) REFERENCES users (id)
                    )
                    """
                )
            )
            db.execute(
                text(
                    """
                    INSERT INTO session_recordings_new (
                        id, session_id, attempt_number, egress_id, object_key, playback_url,
                        status, error_message, created_at, deleted_at, deleted_by_user_id, updated_at
                    )
                    SELECT
                        id,
                        session_id,
                        1,
                        egress_id,
                        object_key,
                        playback_url,
                        status,
                        error_message,
                        COALESCE(updated_at, CURRENT_TIMESTAMP),
                        deleted_at,
                        deleted_by_user_id,
                        updated_at
                    FROM session_recordings
                    """
                )
            )
            db.execute(text("DROP INDEX IF EXISTS ix_session_recordings_session_id"))
            db.execute(text("DROP INDEX IF EXISTS ix_session_recordings_status"))
            db.execute(text("DROP INDEX IF EXISTS ix_session_recordings_created_at"))
            db.execute(text("DROP TABLE session_recordings"))
            db.execute(text("ALTER TABLE session_recordings_new RENAME TO session_recordings"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_session_recordings_session_id ON session_recordings (session_id)"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_session_recordings_status ON session_recordings (status)"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_session_recordings_created_at ON session_recordings (created_at)"))
        elif columns and "deleted_at" not in existing:
            db.execute(text("ALTER TABLE session_recordings ADD COLUMN deleted_at DATETIME"))
        if columns and "deleted_by_user_id" not in existing:
            db.execute(text("ALTER TABLE session_recordings ADD COLUMN deleted_by_user_id VARCHAR(36)"))
        if columns and "attempt_number" not in existing:
            db.execute(text("ALTER TABLE session_recordings ADD COLUMN attempt_number INTEGER NOT NULL DEFAULT 1"))
        if columns and "created_at" not in existing:
            db.execute(text("ALTER TABLE session_recordings ADD COLUMN created_at DATETIME"))
            db.execute(text("UPDATE session_recordings SET created_at = COALESCE(updated_at, CURRENT_TIMESTAMP) WHERE created_at IS NULL"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        columns = db.execute(text("PRAGMA table_info(sessions)")).fetchall()
        existing = {str(row[1]) for row in columns}
        if columns and "source_chat_thread_id" not in existing:
            db.execute(text("ALTER TABLE sessions ADD COLUMN source_chat_thread_id VARCHAR(36)"))
        if columns and "is_instant" not in existing:
            db.execute(text("ALTER TABLE sessions ADD COLUMN is_instant BOOLEAN NOT NULL DEFAULT 0"))
        if columns and "actual_started_at" not in existing:
            db.execute(text("ALTER TABLE sessions ADD COLUMN actual_started_at DATETIME"))
        if columns and "actual_ended_at" not in existing:
            db.execute(text("ALTER TABLE sessions ADD COLUMN actual_ended_at DATETIME"))
        if columns and "actual_duration_seconds" not in existing:
            db.execute(text("ALTER TABLE sessions ADD COLUMN actual_duration_seconds INTEGER NOT NULL DEFAULT 0"))
        if columns and "student_joined_at" not in existing:
            db.execute(text("ALTER TABLE sessions ADD COLUMN student_joined_at DATETIME"))
        if columns and "mentor_joined_at" not in existing:
            db.execute(text("ALTER TABLE sessions ADD COLUMN mentor_joined_at DATETIME"))
        if columns and "call_overlap_started_at" not in existing:
            db.execute(text("ALTER TABLE sessions ADD COLUMN call_overlap_started_at DATETIME"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        columns = db.execute(text("PRAGMA table_info(chat_threads)")).fetchall()
        existing = {str(row[1]) for row in columns}
        if columns and "request_note" not in existing:
            db.execute(text("ALTER TABLE chat_threads ADD COLUMN request_note TEXT"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        columns = db.execute(text("PRAGMA table_info(notifications)")).fetchall()
        existing = {str(row[1]) for row in columns}
        if columns and "event_type" not in existing:
            db.execute(text("ALTER TABLE notifications ADD COLUMN event_type VARCHAR(64)"))
        if columns and "link_path" not in existing:
            db.execute(text("ALTER TABLE notifications ADD COLUMN link_path VARCHAR(255)"))
        db.commit()
    except Exception:
        db.rollback()

    for name, slug in DEFAULT_CATEGORIES:
        existing_category = db.query(Category).filter(Category.slug == slug).first()
        if existing_category:
            continue
        db.add(Category(name=name, slug=slug, is_active=True))

    for email, role in DEFAULT_USERS:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            continue
        db.add(User(email=email, hashed_password=hash_password(DEFAULT_PASSWORD), role=role))
    db.commit()

    users_by_email = {row.email: row for row in db.query(User).filter(User.email.in_([email for email, _ in DEFAULT_USERS])).all()}

    student = users_by_email.get("student.demo@exammentor.com")
    if student:
        profile = db.query(Profile).filter(Profile.user_id == student.id).first()
        if not profile:
            profile = Profile(user_id=student.id)
            db.add(profile)
        profile.full_name = profile.full_name or "Demo Student"
        profile.target_exams = DEFAULT_STUDENT_EXAMS

    mentor = users_by_email.get("mentor.demo@exammentor.com")
    if mentor:
        profile = db.query(Profile).filter(Profile.user_id == mentor.id).first()
        if not profile:
            profile = Profile(user_id=mentor.id)
            db.add(profile)
        profile.full_name = profile.full_name or "Demo Mentor"

        mentor_profile = db.query(MentorProfile).filter(MentorProfile.user_id == mentor.id).first()
        if not mentor_profile:
            mentor_profile = MentorProfile(user_id=mentor.id)
            db.add(mentor_profile)
        mentor_profile.headline = mentor_profile.headline or "GATE mentor for quantitative and technical preparation"
        mentor_profile.exams = DEFAULT_MENTOR_EXAMS
        mentor_profile.years_experience = mentor_profile.years_experience or 6
        mentor_profile.hourly_price = mentor_profile.hourly_price or 499
        mentor_profile.rating_avg = mentor_profile.rating_avg or 4.8
        mentor_profile.verification_status = MentorVerificationStatus.approved

    manager = users_by_email.get("manager.demo@exammentor.com")
    if manager:
        profile = db.query(Profile).filter(Profile.user_id == manager.id).first()
        if not profile:
            profile = Profile(user_id=manager.id)
            db.add(profile)
        profile.full_name = profile.full_name or "Demo Manager"

    admin = users_by_email.get("admin.demo@exammentor.com")
    if admin:
        profile = db.query(Profile).filter(Profile.user_id == admin.id).first()
        if not profile:
            profile = Profile(user_id=admin.id)
            db.add(profile)
        profile.full_name = profile.full_name or "Demo Admin"

    db.commit()

    categories = db.query(Category).order_by(Category.name.asc()).all()
    if admin and categories:
        for category in categories:
            test_title = f"{category.name} Foundation Practice Test"
            existing_test = (
                db.query(PracticeTest)
                .filter(PracticeTest.category_id == category.id, PracticeTest.title == test_title)
                .first()
            )
            if existing_test:
                existing_test.question_count = (
                    db.query(PracticeQuestion)
                    .filter(PracticeQuestion.test_id == existing_test.id, PracticeQuestion.is_active == True)  # noqa: E712
                    .count()
                )
                continue

            test_row = PracticeTest(
                category_id=category.id,
                title=test_title,
                description=f"Ten MCQs to help students measure preparation rhythm and revision quality for {category.name}.",
                created_by_user_id=admin.id,
                is_active=True,
                is_published=True,
                question_count=len(DEFAULT_PRACTICE_QUESTION_TEMPLATES),
            )
            db.add(test_row)
            db.flush()

            for index, template in enumerate(DEFAULT_PRACTICE_QUESTION_TEMPLATES, start=1):
                db.add(
                    PracticeQuestion(
                        test_id=test_row.id,
                        prompt=template["prompt"].format(category=category.name),
                        option_a=template["options"][0],
                        option_b=template["options"][1],
                        option_c=template["options"][2],
                        option_d=template["options"][3],
                        correct_option=template["correct"],
                        explanation=template["explanation"],
                        position=index,
                        is_active=True,
                    )
                )

    seed_default_courses_and_ai_chat_data(db, users_by_email)


def ensure_storage_bucket() -> None:
    if not settings.s3_auto_create_bucket:
        return
    storage = StorageService()
    storage.ensure_bucket()


def seed_default_courses_and_ai_chat_data(db: Session, users_by_email: dict[str, User]) -> None:
    course = db.query(Course).filter(Course.name == "UPPSC").first()
    if not course:
        course = Course(
            name="UPPSC",
            exam_type="State PSC",
            description="UPPSC General Studies preparation track",
            status=CourseStatus.active,
        )
        db.add(course)
        db.flush()

    default_subjects = [
        ("History", "Ancient, medieval, and modern history aligned to UPPSC", 1),
        ("Polity", "Constitution, governance, and public administration basics", 2),
        ("Geography", "Physical and Indian geography for prelims/mains", 3),
        ("Economy", "Indian economy fundamentals and policy topics", 4),
        ("Current Affairs", "National/state current events and issue analysis", 5),
        ("CSAT", "Aptitude, reasoning, and comprehension practice", 6),
    ]

    for name, description, priority in default_subjects:
        existing_subject = (
            db.query(Subject)
            .filter(Subject.course_id == course.id, Subject.name == name)
            .first()
        )
        if existing_subject:
            continue
        db.add(
            Subject(
                course_id=course.id,
                name=name,
                description=description,
                syllabus=description,
                priority=priority,
            )
        )

    student = users_by_email.get("student.demo@exammentor.com")
    if student:
        enrollment = (
            db.query(StudentCourseEnrollment)
            .filter(
                StudentCourseEnrollment.student_id == student.id,
                StudentCourseEnrollment.course_id == course.id,
            )
            .first()
        )
        if not enrollment:
            db.add(
                StudentCourseEnrollment(
                    student_id=student.id,
                    course_id=course.id,
                    current_level=CurrentLevel.beginner,
                    daily_study_time_minutes=120,
                    status=EnrollmentStatus.active,
                    preferences={"focus": "balanced"},
                )
            )

    db.commit()
