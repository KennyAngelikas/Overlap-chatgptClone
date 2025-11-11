from server.app     import app
from server.website import Website
from server.controller.conversation_controller import ConversationController

from json import load

if __name__ == '__main__':
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

    print(f"Running on port {site_config['port']}")
    app.run(**site_config)
    print(f"Closing port {site_config['port']}")
