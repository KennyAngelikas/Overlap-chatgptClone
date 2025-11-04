# This file initializes the Flask application for the server.

from flask import Flask

app = Flask(__name__, template_folder='./../client/html')
