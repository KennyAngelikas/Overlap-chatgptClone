from server.app     import app
from server.website import Website
from server.controller.conversation_controller import ConversationController
import os
from server.controller.teams_memory_controller import TeamsMemoryController
from server.controller.teams_db_controller import TeamsDBController
from json import load

# --- VERCEL FIX: MOVED ROUTE LOGIC OUTSIDE __main__ ---

# This code will now run when Vercel imports the file
config = load(open('config.json', 'r'))
site_config = config['site_config']

site = Website(app)
for route in site.routes:
    app.add_url_rule(
        route,
        view_func = site.routes[route]['function'],
        methods   = site.routes[route]['methods'],
    )

ConversationController(app)
# Prefer DB-backed teams controller when DB environment is present
if os.environ.get('DB_HOST') or os.environ.get('DATABASE_URL'):
    TeamsDBController(app)
else:
    TeamsMemoryController(app)

# We also need to add the root route you were missing
@app.route('/', methods=['GET'])
def handle_root():
    # You can return a real page, or just a simple message
    return "Hello, my VAn_buil_buil_t app is working!"

# --- END VERCEL FIX ---


# This block will *only* be used when you run "python run.py" locally
if __name__ == '__main__':
    print(f"Running on port {site_config['port']}")
    app.run(**site_config)
    print(f"Closing port {site_config['port']}")