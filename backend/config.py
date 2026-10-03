# backend/config.py

import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH)

ALBUMS_DIR = os.path.join(BASE_DIR, "albums")
ENHANCED_DIR = os.path.join(ALBUMS_DIR, "enhanced")
DB_PATH = os.path.join(BASE_DIR, "database.db")

# Secrets must be supplied through backend/.env or the process environment.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
YOUCAM_API_KEY = os.getenv("YOUCAM_API_KEY", "")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_HTTP_TIMEOUT_MS = int(os.getenv("GEMINI_HTTP_TIMEOUT_MS", "60000"))
GEMINI_MAX_RETRIES = int(os.getenv("GEMINI_MAX_RETRIES", "2"))
GEMINI_CLASSIFY_BATCH_SIZE = int(
    os.getenv("GEMINI_CLASSIFY_BATCH_SIZE", "4")
)
GEMINI_DIRECT_THRESHOLD = int(os.getenv("GEMINI_DIRECT_THRESHOLD", "4"))

os.makedirs(ALBUMS_DIR, exist_ok=True)
os.makedirs(ENHANCED_DIR, exist_ok=True)
