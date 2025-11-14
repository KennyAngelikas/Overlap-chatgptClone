from server.app     import app
from server.website import Website
from server.controller.conversation_controller import ConversationController
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