Overlap-chatgptCloneThis is the backend server for the Overlap ChatGPT Clone, a Flask application designed to serve a chat API. It is configured for deployment on Vercel using a custom Docker build environment.🚀 How to Run LocallyFollow these steps to run the server on your local machine for development.1. PrerequisitesPython 3.12A Python virtual environment (recommended)A config.json file (see below)2. Local InstallationClone the repository:git clone [https://github.com/KennyAngelikas/Overlap-chatgptClone]
cd Overlap-chatgptClone
Create and activate a virtual environment:python3 -m venv venv
source venv/bin/activate
Install the required Python packages:pip install -r requirements.txt
Create your configuration file. Your app reads settings from config.json. Create this file in the root directory.{
  "site_config": {
    "host": "0.0.0.0",
    "port": 1338,
    "debug": true
  },
  "database": {
    "url": "postgresql://user:password@localhost:5432/mydb"
  },
  "api_keys": {
    "gemini": "YOUR_GEMINI_API_KEY_HERE"
  }
}
Run the application:python run.py
Your server should now be running on http://localhost:1338.📦 How to Deploy to VercelThis project is deployed using a prebuilt output from a custom Docker container. This complex process is required to build psycopg2 correctly for Vercel's Amazon Linux runtime.1. PrerequisitesDocker Desktop must be installed and running.Vercel CLI must be installed: npm install -g vercelA Vercel account.2. Required Project FilesYou must have these four files in your project's root directory.DockerfileThis file builds your project inside an environment identical to Vercel's (Amazon Linux 2023).# Stage 1: The "builder"
# USE THE OFFICIAL AWS LAMBDA PYTHON 3.12 IMAGE (Amazon Linux 2023)
FROM public.ecr.aws/lambda/python:3.12 AS builder

WORKDIR /app

# Install build tools, node, and npm using DNF
RUN dnf update -y && dnf install -y "Development Tools" nodejs npm

# 2. Install Python dependencies
COPY requirements.txt requirements.txt
RUN pip3 install --user --no-cache-dir -r requirements.txt
# Add Python's user bin to the PATH
ENV PATH=/root/.local/bin:$PATH

# 3. Install Vercel CLI
RUN npm install --global vercel@latest

# 4. Copy all your project files
COPY . .

# 5. Copy your Vercel project link
COPY .vercel .vercel

# 6. Build the project using Vercel CLI
ARG VERCEL_TOKEN
RUN VERCEL_TOKEN=$VERCEL_TOKEN vercel build --prod

# ---
# Stage 2: The "final output"
FROM alpine:latest

# Copy the entire .vercel folder
COPY --from=builder /app/.vercel /.vercel
vercel.jsonThis file tells Vercel how to build and route your Python app.{
  "builds": [
    {
      "src": "run.py",
      "use": "@vercel/python",
      "config": { "pythonVersion": "3.12" }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "run.py"
    }
  ]
}
requirements.txtMake sure this file uses psycopg2-binary.flask
python-dotenv
requests
beautifulsoup4
psycopg2-binary
# ... any other libraries
.dockerignoreThis speeds up your Docker build by ignoring unnecessary files.# Venv
venv/

# Docker build output
.vercel

# Python cache
__pycache__/
*.pyc
3. ⚠️ Important: Fix config.json for VercelYour run.py script (which reads config.json) will fail on Vercel. Vercel uses Environment Variables for secrets, not JSON files.You must modify your run.py to read from os.environ.Original run.py (Local only):# ...
from json import load

if __name__ == '__main__':
    config = load(open('config.json', 'r'))
    site_config = config['site_config']
    # ...
Modified run.py (Works locally AND on Vercel):from server.app     import app
from server.website import Website
from server.controller.conversation_controller import ConversationController
from json import load
import os # Import os

# --- VERCEL FIX ---
# Check if running on Vercel (or any system with ENV VARS)
db_url = os.environ.get('DATABASE_URL')
site_port = os.environ.get('PORT', 1338) # Vercel provides a PORT

if db_url:
    # We are on Vercel or similar
    site_config = {
        "host": "0.0.0.0",
        "port": int(site_port),
        "debug": False
    }
    # You would also load other configs (like GEMINI_API_KEY) here
    # os.environ.get('GEMINI_API_KEY')
else:
    # We are local, load from config.json
    config = load(open('config.json', 'r'))
    site_config = config['site_config']
    # You would also load DB URL from config here
    # db_url = config['database']['url']
# --- END FIX ---


# This logic is now outside the __name__ block
site = Website(app)
for route in site.routes:
    app.add_url_rule(
        route,
        view_func = site.routes[route]['function'],
        methods   = site.routes[route]['methods'],
    )

ConversationController(app)

# This will run for a 404
@app.route('/', methods=['GET'])
def handle_root():
    return "Flask server is running!"

# This block is for local development only
if __name__ == '__main__':
    print(f"Running on port {site_config['port']}")
    app.run(**site_config)
    print(f"Closing port {site_config['port']}")
4. Deployment StepsStep 1: One-Time Vercel SetupLog in to Vercel CLI:vercel login
Link your project:vercel link
Pull project settings:vercel pull --yes
Add Vercel Environment Variables:Go to your project's dashboard on Vercel.Go to Settings > Environment Variables.Add all your secrets (e.g., DATABASE_URL, GEMINI_API_KEY). These must match the os.environ.get() keys in your run.py.Step 2: The 6-Step Deploy ProcessRun these commands from your project's root directory every time you want to deploy a change.Build the Docker image: (This will take a few minutes)docker build --build-arg VERCEL_TOKEN="YOUR_VERCEL_TOKEN_HERE" -t overlap-chatgpt .
(Get your token from Vercel Dashboard > Settings > Tokens)Remove the old container (in case it exists):docker rm temp_container
Create a new container from the image:docker create --name temp_container overlap-chatgpt
Copy the build output from the container to your computer:docker cp temp_container:/.vercel .
Clean up the container:docker rm temp_container
Deploy the prebuilt output!vercel deploy --prebuilt --prod
🔌 Architecture: Client-Server InteractionThis repository is a JSON API backend. It is only the "server" part of your application.Client (The "Browser")A user visits your Vercel URL (e.g., https://overlap-chatgpt-clone.vercel.app).Vercel serves your static frontend (e.g., React, HTML/JS) from the Website routes.The user types a message in the chat.Server (This Flask App)Your frontend's JavaScript makes an HTTP request (e.g., a POST request to /api/chat) with the user's message.Vercel routes this request to your run.py serverless function.The ConversationController receives the request.It calls services like gemini_service (to talk to an AI) and teams_service (to get data).The teams_service uses db_model to query your PostgreSQL database (using psycopg2).The services return data to the controller.ResponseThe ConversationController formats a JSON response.Flask sends this JSON back to the client.Your frontend's JavaScript receives the JSON and displays the chat message to the user.