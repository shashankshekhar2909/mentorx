from sqlalchemy.orm import Session
from sqlalchemy import text

from ..core.rbac import Role
from ..core.security import hash_password
from ..models.category import Category
from ..models.user import User


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
