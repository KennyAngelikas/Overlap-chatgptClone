# Project Overlap 
UPDATE THIS IMAGE WITH AN EXAMPLE IMAGE 
<img width="1470" alt="image" src="https://user-images.githubusercontent.com/98614666/232768610-fdeada85-3d21-4cf9-915e-a0ec9f3b7a9f.png">

## Overview
### Project Abstract
Overlap is a collaborative chatbot ecosystem designed to enhance peer-to-peer knowledge sharing within a team. Instead of acting as a generic Q&A assistant, the system connects teammates to one another based on overlapping interests, recent learning activity, or self-declared expertise.

Each team member has a personal chatbot (e.g., in Slack). When a user asks their bot for help — for example, “Teach me React basics.” — the bot consults a shared, opt-in knowledge index to identify peers who either know or recently asked about React. If a match is found, the bot responds: “Bob has ‘React’ expertise, and Alice asked about React two days ago. Want to connect with them?” 

This replaces solitary AI help with socially intelligent nudges that build team relationships while maintaining individual privacy. Later phases will visualize shared learning across the team through a mind-map view, showing connections between topics and people (opt-in only).

### Novelty
Why is this novel? Recent work shows that AI is eroding the social fabric inside and outside the classroom. Students are going to TAs, peers, and instructors at the lowest rates ever. That’s a problem because peer support is tightly linked to students’ wellbeing—and without it, students feel more isolated than ever.

_**Our AI directly confronts this. Instead of replacing relationships, it is designed to build them.**_

A second piece of novelty is how we handle “expertise finding.” Academic teams struggle to know who to go to for help. Our AI reduces that cognitive load by matching the questions students ask with the knowledge and experience already present in their community, connecting them to the right expert and strengthening human relationships along the way.


# Testing 
feel free to improve the code / suggest improvements

## Client + Testing
To test our application, please go here --> https://overlap-chatgpt-clone-oah03fquq-manvender-singhs-projects.vercel.app/chat/
```
WARNING: PLEASE DO NOT PROMPT TOO MUCH OR IT WILL START CHARGING YOU
```

## Getting Started Development
To get started with this project, you'll need to clone the repository and set up a virtual environment. This will allow you to install the required dependencies without affecting your system-wide Python installation.

### Prequisites
Before you can set up a virtual environment, you'll need to have Python installed on your system. You can download Python from the official website: https://www.python.org/downloads/

### Cloning the Repository
Run the following command to clone the repository:
```
git clone this repo
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

