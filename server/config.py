# server/config.py
import os
from dotenv import load_dotenv

# Load environment variables from a local .env file (for dev)
# AND from the actual environment (e.g., Vercel env vars).
load_dotenv()

# --- GEMINI API KEY --------------------------------------------------------

# Your Gemini API key.
# Set this in:
#   - .env for local development (GEMINI_API_KEY=...)
#   - Vercel → Project Settings → Environment Variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    # We don't raise an error here so local imports still work,
    # but any call that actually hits Gemini will fail.
    print(
        "[config] WARNING: GEMINI_API_KEY is not set. "
        "Gemini API calls will fail until you configure this."
    )

# --- GEMINI MODEL (fixed choice for this app) ------------------------------

# Single model this app uses for all Gemini calls.
# If you ever want to switch models, change this string.
GEMINI_MODEL = "gemini-1.5-flash"