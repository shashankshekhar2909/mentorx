from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import Base, SessionLocal, engine
from .routers import admin, ai, auth, bookings, categories, chats, mentors, notifications, payments, practice, resources, reviews, sessions, uploads, users, webhooks
from .services.bootstrap_service import ensure_storage_bucket, seed_default_users


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)
    origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth.router, prefix=settings.api_prefix)
    app.include_router(categories.router, prefix=settings.api_prefix)
    app.include_router(users.router, prefix=settings.api_prefix)
    app.include_router(mentors.router, prefix=settings.api_prefix)
    app.include_router(bookings.router, prefix=settings.api_prefix)
    app.include_router(chats.router, prefix=settings.api_prefix)
    app.include_router(sessions.router, prefix=settings.api_prefix)
    app.include_router(payments.router, prefix=settings.api_prefix)
    app.include_router(practice.router, prefix=settings.api_prefix)
    app.include_router(uploads.router, prefix=settings.api_prefix)
    app.include_router(webhooks.router, prefix=settings.api_prefix)
    app.include_router(resources.router, prefix=settings.api_prefix)
    app.include_router(reviews.router, prefix=settings.api_prefix)
    app.include_router(notifications.router, prefix=settings.api_prefix)
    app.include_router(admin.router, prefix=settings.api_prefix)
    app.include_router(ai.router, prefix=settings.api_prefix)

    @app.on_event("startup")
    def on_startup() -> None:
        from . import models  # noqa: F401

        # MVP bootstrap for SQLite/local runs.
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_default_users(db)
        finally:
            db.close()
        ensure_storage_bucket()

    return app
