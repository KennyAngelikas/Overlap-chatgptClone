# Overlap
- Overlap is a team-first chat assistant that nudges teammates toward each other.  
- When someone asks a question, the system checks a shared, opt‑in skills index and, if relevant, suggests which teammate(s) might help — replacing solitary AI answers with socially aware guidance.

## MVP (minimal viable product)
- Simple web chat UI (single‑page) that sends {user_id, team_id, prompt} to the server.  
- Team and user records with a short skills survey (store in SQLite for MVP).  
- Backend augmentation: before calling the model, do a fast skill-match (keyword or simple normalization) and inject one short hint into the prompt if a teammate matches.  
- Stream model responses back to the client unchanged except for the injected hint.  
- Basic seed data, Docker support, and environment variable for the model API key.  
- No production auth in MVP (trusted user_id); plan to add auth before public use.

## User journey (MVP)
1. Join or create a team and complete a quick skills survey.  
2. Open chat and ask a question.  
3. Server checks team skills and finds possible matches.  
4. If a match exists, the reply includes a short suggestion like “Alice knows React — want to connect?”  
5. Conversation is logged; skill usage counters may be updated for future recommendations.

## User personas
#Four USer Personas:

Sam — Product Manager
    Goal: Get a quick, team-aware answer or a referral to the right teammate.
    Scenario: Asks “How do we track onboarding metrics?” and is suggested to talk to Maya, who owns analytics.

## To do
- [x] Double confirm when deleting conversation
- [x] remember user preferences
- [x] theme changer
- [ ] loading / exporting a conversation
- [ ] speech output and input (elevenlabs; ex: https://github.com/cogentapps/chat-with-gpt)
- [ ] load files, ex: https://github.com/mayooear/gpt4-pdf-chatbot-langchain
- [ ] better documentation
- [ ] use react / faster backend language ? (newbies may be more confused and discouraged to use it)
 
# ChatGPT Clone
feel free to improve the code / suggest improvements

<img width="1470" alt="image" src="https://user-images.githubusercontent.com/98614666/232768610-fdeada85-3d21-4cf9-915e-a0ec9f3b7a9f.png">


## Getting Started
To get started with this project, you'll need to clone the repository and set up a virtual environment. This will allow you to install the required dependencies without affecting your system-wide Python installation.

### Prequisites
Before you can set up a virtual environment, you'll need to have Python installed on your system. You can download Python from the official website: https://www.python.org/downloads/

### Cloning the Repository
Run the following command to clone the repository:
```
git clone https://github.com/xtekky/chatgpt-clone.git
```

### Setting up a Virtual Environment
To set up a virtual environment, follow these steps:

1. Navigate to the root directory of your project.
```
cd chatgpt-clone
```
2. Run the following command to create a new virtual environment:
```
python -m venv venv
```
3.  Activate the virtual environment by running the following command:
```
source venv/bin/activate
```
If you are using fish shell, the command will be slightly different:
```
source venv/bin/activate.fish
```
If you're on Windows, the command will be slightly different:
```
venv\Scripts\activate
```
4. Install the required dependencies by running the following command:
```
pip install -r requirements.txt
```

### Configure the Application
To configure the application, there are a few properties that can be set either via the environment or via config.json.  The environment variable takes priority.

| Field               | Env Variable    | config.json     | examples                                           |
|---------------------|-----------------|-----------------|----------------------------------------------------|
| The OpenAI Api Key  | OPENAI_API_KEY  | openai_key      | sk-...                                             
| The OpenAI Base URL | OPENAI_API_BASE | openai_api_base | https://api.openai.com <br> http://my-reverse-proxy/ 

Use the Base URL if you need to run your queries through a reverse proxy (like [this one](https://github.com/stulzq/azure-openai-proxy) which will run your queries through Azure's OpenAI endpoints )


### Running the Application
To run the application, make sure the virtual environment is active and run the following command:
```
python run.py
```

### Docker
The easiest way to run ChatGPT Clone is by using docker
```
docker-compose up
```

