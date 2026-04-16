from __future__ import annotations

import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./zenvy.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    _ensure_backwards_compatible_schema()


def _ensure_backwards_compatible_schema():
    inspector = inspect(engine)

    if "users" in inspector.get_table_names():
        _ensure_columns(
            "users",
            {
                "lang": "VARCHAR DEFAULT 'en'",
            },
        )

    if "policies" in inspector.get_table_names():
        _ensure_columns(
            "policies",
            {
                "payment_method": "VARCHAR DEFAULT 'upi'",
                "payment_reference": "VARCHAR",
            },
        )

    if "claims" in inspector.get_table_names():
        _ensure_columns(
            "claims",
            {
                "fraud_reasons": "TEXT DEFAULT '[]'",
                "review_note": "TEXT",
                "reviewed_by": "INTEGER",
                "reviewed_at": "DATETIME",
                "processing_started_at": "DATETIME",
                "payout_reference": "VARCHAR",
                "payout_link": "VARCHAR",
                "event_metadata": "TEXT DEFAULT '{}'",
            },
        )

    if "alerts" in inspector.get_table_names():
        _ensure_columns(
            "alerts",
            {
                "event_code": "VARCHAR",
            },
        )

    if "notifications" not in inspector.get_table_names():
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    CREATE TABLE notifications (
                        id INTEGER PRIMARY KEY,
                        user_id INTEGER,
                        message TEXT NOT NULL,
                        type VARCHAR NOT NULL,
                        title VARCHAR,
                        metadata_json TEXT DEFAULT '{}',
                        is_read BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(user_id) REFERENCES users (id)
                    )
                    """
                )
            )


def _ensure_columns(table_name: str, columns: dict[str, str]):
    inspector = inspect(engine)
    existing = {column["name"] for column in inspector.get_columns(table_name)}
    missing = {name: ddl for name, ddl in columns.items() if name not in existing}
    if not missing:
        return

    with engine.begin() as connection:
        for name, ddl in missing.items():
            connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {name} {ddl}"))
