import os
from json import load
from time import time
from os import urandom
from pathlib import Path

from flask import Flask, render_template, send_file, redirect

from server.controller.conversation_controller import ConversationController
from server.controller.teams_memory_controller import TeamsMemoryController
from server.controller.teams_db_controller import TeamsDBController
from dotenv import load_dotenv 

# Load the .env file
load_dotenv()
# --- PATHS & APP SETUP ---
'''
This is saving where does the html lives, we need this to give to Flask 
the html folder so it can send the html to the browser
'''
BASE_DIR = Path(__file__).resolve().parent
CLIENT_DIR = BASE_DIR / "client"
TEMPLATE_DIR = CLIENT_DIR / "html" 

# App is the flask app object, where all routes hang off of
# We tell Flask where to find the html templates, so render_template works
app = Flask(__name__, template_folder=str(TEMPLATE_DIR))

# Load config for local dev (port, host, etc.)
config = load(open(BASE_DIR / "config.json", "r"))
site_config = config["site_config"]


# --- FRONTEND ROUTES (what Website used to do) ---

def _generate_chat_id() -> str:
    """Generate a chat_id similar to the old Website._index implementation."""
    return (
        f"{urandom(4).hex()}-"
        f"{urandom(2).hex()}-"
        f"{urandom(2).hex()}-"
        f"{urandom(2).hex()}-"
        f"{hex(int(time() * 1000))[2:]}"
    )


from dotenv import load_dotenv 


# Helper to get config
def get_firebase_config():
    return {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID")
    }

@app.route('/')
def home():
    # Pass config to the landing page
    return render_template('index.html', firebase_config=get_firebase_config())


@app.route("/chat/", methods=["GET", "POST"])
def chat_index():
    # Old Website._index: render index.html with a fresh chat_id
    return render_template("chat.html", chat_id=_generate_chat_id())


@app.route("/chat/<conversation_id>", methods=["GET", "POST"])
def chat(conversation_id):
    # Old Website._chat: validate, then render with that conversation_id
    if "-" not in conversation_id:
        return redirect("/chat/")
    return render_template("index.html", chat_id=conversation_id)


@app.route("/assets/<folder>/<file>", methods=["GET", "POST"])
def assets(folder: str, file: str):
    # Old Website._assets: serve static files from client/
    filepath = CLIENT_DIR / folder / file
    if not filepath.exists():
        return "File not found", 404
    return send_file(str(filepath), as_attachment=False)


# --- API CONTROLLERS (unchanged behavior) ---

# Conversation API routes
ConversationController(app)

# Prefer DB-backed teams controller when DB environment is present
if os.environ.get("DB_HOST") or os.environ.get("DATABASE_URL"):
    TeamsDBController(app)
else:
    TeamsMemoryController(app)


# --- LOCAL DEV ENTRYPOINT (Vercel will NOT run this) ---

if __name__ == "__main__":
    print(f"Running on port {site_config['port']}")
    app.run(**site_config)
    print(f"Closing port {site_config['port']}")
