"""Local evidence API backed by SQLite WAL + FTS5. Performs no block device writes."""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import os
from pathlib import Path
import re
import sqlite3
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

DB_PATH = Path(os.environ.get("AUDIT_DB_PATH", "/data/audit-evidence.sqlite3"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Audit USB Flasher Evidence API", version="1.3.0")

LOCAL_HOSTS = {"localhost", "127.0.0.1"}


def is_allowed_origin(origin: str) -> bool:
    if not origin:
        return False
    parsed = urlparse(origin)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    if host in LOCAL_HOSTS:
        return True
    if parsed.scheme == "https" and host.endswith(".github.io"):
        return True
    return False


class PrivateNetworkAccessMiddleware(BaseHTTPMiddleware):
    """Answer Chromium Private Network Access preflight probes for loopback origins."""

    async def dispatch(self, request, call_next):
        origin = request.headers.get("origin", "")
        pna_req = request.headers.get("access-control-request-private-network") == "true"

        if request.method == "OPTIONS" and pna_req and is_allowed_origin(origin):
            return Response(
                status_code=204,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "content-type, access-control-request-private-network",
                    "Access-Control-Allow-Private-Network": "true",
                    "Access-Control-Max-Age": "600",
                    "Vary": "Origin",
                },
            )

        response = await call_next(request)
        if is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response


app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://((localhost|127\.0\.0\.1)(:\d+)?|[a-z0-9-]+\.github\.io)$",
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Access-Control-Request-Private-Network"],
)
app.add_middleware(PrivateNetworkAccessMiddleware)


@contextmanager
def connection():
    conn = sqlite3.connect(DB_PATH, timeout=5.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=5000")
    try:
        yield conn
    finally:
        conn.close()


def initialize():
    with connection() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY,
                created_at TEXT NOT NULL,
                category TEXT NOT NULL,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                metadata_json TEXT NOT NULL DEFAULT '{}'
            )
            """
        )
        db.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS events_fts
            USING fts5(category, severity, message, content='events', content_rowid='id')
            """
        )
        db.executescript(
            """
            CREATE TRIGGER IF NOT EXISTS events_ai AFTER INSERT ON events BEGIN
                INSERT INTO events_fts(rowid, category, severity, message)
                VALUES (new.id, new.category, new.severity, new.message);
            END;
            CREATE TRIGGER IF NOT EXISTS events_au AFTER UPDATE ON events BEGIN
                INSERT INTO events_fts(events_fts, rowid, category, severity, message)
                VALUES ('delete', old.id, old.category, old.severity, old.message);
                INSERT INTO events_fts(rowid, category, severity, message)
                VALUES (new.id, new.category, new.severity, new.message);
            END;
            CREATE TRIGGER IF NOT EXISTS events_ad AFTER DELETE ON events BEGIN
                INSERT INTO events_fts(events_fts, rowid, category, severity, message)
                VALUES ('delete', old.id, old.category, old.severity, old.message);
            END;
            CREATE INDEX IF NOT EXISTS events_created_idx ON events(created_at);
            CREATE INDEX IF NOT EXISTS events_severity_idx ON events(severity);
            """
        )
        db.commit()


class EventIn(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    severity: str = Field(default="info", pattern="^(info|warning|error)$")
    message: str = Field(min_length=1, max_length=8000)
    metadata_json: str = Field(default="{}", max_length=8000)


@app.on_event("startup")
def startup():
    initialize()


@app.get("/api/health")
def health():
    with connection() as db:
        version = db.execute("SELECT sqlite_version()").fetchone()[0]
        compile_fts = db.execute("SELECT sqlite_compileoption_used('ENABLE_FTS5')").fetchone()[0]
        try:
            db.execute("SELECT rowid FROM events_fts LIMIT 1").fetchone()
            query_fts = True
        except sqlite3.OperationalError:
            query_fts = False

    return {
        "status": "ok",
        "sqlite": version,
        "fts5": bool(query_fts or compile_fts),
        "database": str(DB_PATH),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/events", status_code=201)
def add_event(event: EventIn):
    with connection() as db:
        try:
            cursor = db.execute(
                """
                INSERT INTO events(created_at, category, severity, message, metadata_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    datetime.now(timezone.utc).isoformat(),
                    event.category,
                    event.severity,
                    event.message,
                    event.metadata_json,
                ),
            )
            db.commit()
        except sqlite3.OperationalError as exc:
            db.rollback()
            raise HTTPException(status_code=503, detail=f"SQLite write error: {exc}") from exc
        return {"id": cursor.lastrowid, "stored": True}


@app.get("/api/events")
def list_events(limit: int = 50):
    if limit < 1 or limit > 250:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 250")
    with connection() as db:
        rows = db.execute(
            "SELECT id, created_at, category, severity, message FROM events ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def normalize_fts_query(raw: str) -> str:
    tokens = re.findall(r"[A-Za-z0-9_]+", raw)
    if not tokens:
        raise HTTPException(status_code=400, detail="Search query must contain alphanumeric terms")
    return " AND ".join(f'"{t}"' for t in tokens[:12])


@app.get("/api/search")
def search_events(q: str):
    if not q.strip() or len(q) > 200:
        raise HTTPException(status_code=400, detail="q must contain 1-200 characters")
    fts_expr = normalize_fts_query(q)
    with connection() as db:
        try:
            rows = db.execute(
                """
                SELECT e.id, e.created_at, e.category, e.severity, e.message
                FROM events_fts f
                JOIN events e ON e.id = f.rowid
                WHERE events_fts MATCH ?
                ORDER BY e.id DESC
                LIMIT 100
                """,
                (fts_expr,),
            ).fetchall()
        except sqlite3.OperationalError as exc:
            raise HTTPException(status_code=400, detail=f"FTS5 search error: {exc}") from exc
    return [dict(row) for row in rows]
