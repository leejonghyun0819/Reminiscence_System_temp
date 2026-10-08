# backend/database.py
import sqlite3
from contextlib import contextmanager
from config import DB_PATH

@contextmanager
def get_db_cursor():
    """DB 연결, 커밋 및 자원 해제를 자동으로 처리하는 컨텍스트 매니저"""
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    cursor = conn.cursor()
    try:
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db_cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                file_names_json TEXT NOT NULL,
                image_urls_json TEXT NOT NULL,
                audio_file_name TEXT,
                audio_url TEXT,
                title TEXT,
                location TEXT,
                year_estimate TEXT,
                description TEXT,
                story_caption TEXT,
                audio_transcript_summary TEXT,
                category_folder TEXT DEFAULT '미분류',
                history_json TEXT DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        try:
            cursor.execute("ALTER TABLE memories ADD COLUMN category_folder TEXT DEFAULT '미분류'")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE memories ADD COLUMN history_json TEXT DEFAULT '[]'")
        except Exception:
            pass

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS folders (
                name TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS generated_notes (
                id TEXT PRIMARY KEY,
                note_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

# 모듈 로드 시 최초 1회 실행 보장
init_db()
