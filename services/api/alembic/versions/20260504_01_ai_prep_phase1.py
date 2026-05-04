"""ai prep phase1 tables

Revision ID: 20260504_01
Revises:
Create Date: 2026-05-04
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260504_01"
down_revision = None
branch_labels = None
depends_on = None


chat_mode_enum = sa.Enum(
    "doubt_solving",
    "study_planning",
    "revision",
    "mock_test_review",
    "concept_learning",
    "general_preparation",
    name="aichatmode",
)
chat_session_status_enum = sa.Enum("active", "archived", name="aichatsessionstatus")
chat_role_enum = sa.Enum("user", "assistant", "system", "tool", name="aichatrole")
course_status_enum = sa.Enum("active", "inactive", name="coursestatus")
current_level_enum = sa.Enum("beginner", "intermediate", "advanced", name="currentlevel")
enrollment_status_enum = sa.Enum("active", "paused", "completed", name="enrollmentstatus")
memory_type_enum = sa.Enum(
    "weakness",
    "strength",
    "goal",
    "confusion",
    "learning_style",
    "revision_need",
    "deadline",
    "mistake_pattern",
    name="learningmemorytype",
)
priority_enum = sa.Enum("low", "medium", "high", name="studyactionpriority")
action_status_enum = sa.Enum("pending", "in_progress", "completed", "skipped", name="studyactionstatus")


def upgrade() -> None:
    op.create_table(
        "courses",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("exam_type", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", course_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_courses_name", "courses", ["name"])

    op.create_table(
        "subjects",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("course_id", sa.String(length=36), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("syllabus", sa.Text(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_subjects_course_id", "subjects", ["course_id"])

    op.create_table(
        "student_course_enrollments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("student_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("course_id", sa.String(length=36), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("target_exam_date", sa.Date(), nullable=True),
        sa.Column("current_level", current_level_enum, nullable=False),
        sa.Column("daily_study_time_minutes", sa.Integer(), nullable=False),
        sa.Column("preferences", sa.JSON(), nullable=True),
        sa.Column("status", enrollment_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_student_course_enrollments_student_id", "student_course_enrollments", ["student_id"])
    op.create_index("ix_student_course_enrollments_course_id", "student_course_enrollments", ["course_id"])

    op.create_table(
        "ai_chat_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("student_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("course_id", sa.String(length=36), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("subject_id", sa.String(length=36), sa.ForeignKey("subjects.id"), nullable=True),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("mode", chat_mode_enum, nullable=False),
        sa.Column("status", chat_session_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_chat_sessions_student_id", "ai_chat_sessions", ["student_id"])
    op.create_index("ix_ai_chat_sessions_course_id", "ai_chat_sessions", ["course_id"])
    op.create_index("ix_ai_chat_sessions_subject_id", "ai_chat_sessions", ["subject_id"])

    op.create_table(
        "ai_chat_messages",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), sa.ForeignKey("ai_chat_sessions.id"), nullable=False),
        sa.Column("role", chat_role_enum, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("model", sa.String(length=120), nullable=True),
        sa.Column("provider", sa.String(length=80), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_chat_messages_session_id", "ai_chat_messages", ["session_id"])

    op.create_table(
        "student_learning_memories",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("student_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("course_id", sa.String(length=36), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("subject_id", sa.String(length=36), sa.ForeignKey("subjects.id"), nullable=True),
        sa.Column("memory_type", memory_type_enum, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("confidence_score", sa.Integer(), nullable=False),
        sa.Column("source_session_id", sa.String(length=36), sa.ForeignKey("ai_chat_sessions.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_student_learning_memories_student_id", "student_learning_memories", ["student_id"])
    op.create_index("ix_student_learning_memories_course_id", "student_learning_memories", ["course_id"])
    op.create_index("ix_student_learning_memories_subject_id", "student_learning_memories", ["subject_id"])
    op.create_index("ix_student_learning_memories_memory_type", "student_learning_memories", ["memory_type"])

    op.create_table(
        "ai_study_actions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("student_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("course_id", sa.String(length=36), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("subject_id", sa.String(length=36), sa.ForeignKey("subjects.id"), nullable=True),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", priority_enum, nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", action_status_enum, nullable=False),
        sa.Column("source_session_id", sa.String(length=36), sa.ForeignKey("ai_chat_sessions.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_study_actions_student_id", "ai_study_actions", ["student_id"])
    op.create_index("ix_ai_study_actions_course_id", "ai_study_actions", ["course_id"])
    op.create_index("ix_ai_study_actions_subject_id", "ai_study_actions", ["subject_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_study_actions_subject_id", table_name="ai_study_actions")
    op.drop_index("ix_ai_study_actions_course_id", table_name="ai_study_actions")
    op.drop_index("ix_ai_study_actions_student_id", table_name="ai_study_actions")
    op.drop_table("ai_study_actions")

    op.drop_index("ix_student_learning_memories_memory_type", table_name="student_learning_memories")
    op.drop_index("ix_student_learning_memories_subject_id", table_name="student_learning_memories")
    op.drop_index("ix_student_learning_memories_course_id", table_name="student_learning_memories")
    op.drop_index("ix_student_learning_memories_student_id", table_name="student_learning_memories")
    op.drop_table("student_learning_memories")

    op.drop_index("ix_ai_chat_messages_session_id", table_name="ai_chat_messages")
    op.drop_table("ai_chat_messages")

    op.drop_index("ix_ai_chat_sessions_subject_id", table_name="ai_chat_sessions")
    op.drop_index("ix_ai_chat_sessions_course_id", table_name="ai_chat_sessions")
    op.drop_index("ix_ai_chat_sessions_student_id", table_name="ai_chat_sessions")
    op.drop_table("ai_chat_sessions")

    op.drop_index("ix_student_course_enrollments_course_id", table_name="student_course_enrollments")
    op.drop_index("ix_student_course_enrollments_student_id", table_name="student_course_enrollments")
    op.drop_table("student_course_enrollments")

    op.drop_index("ix_subjects_course_id", table_name="subjects")
    op.drop_table("subjects")

    op.drop_index("ix_courses_name", table_name="courses")
    op.drop_table("courses")

    action_status_enum.drop(op.get_bind(), checkfirst=False)
    priority_enum.drop(op.get_bind(), checkfirst=False)
    memory_type_enum.drop(op.get_bind(), checkfirst=False)
    chat_role_enum.drop(op.get_bind(), checkfirst=False)
    chat_session_status_enum.drop(op.get_bind(), checkfirst=False)
    chat_mode_enum.drop(op.get_bind(), checkfirst=False)
    enrollment_status_enum.drop(op.get_bind(), checkfirst=False)
    current_level_enum.drop(op.get_bind(), checkfirst=False)
    course_status_enum.drop(op.get_bind(), checkfirst=False)
