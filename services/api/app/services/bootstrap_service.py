from sqlalchemy.orm import Session
from sqlalchemy import text

from ..core.rbac import Role
from ..core.security import hash_password
from ..models.category import Category
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


def ensure_storage_bucket() -> None:
    storage = StorageService()
    storage.ensure_bucket()
