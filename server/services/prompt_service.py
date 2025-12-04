# services/prompt_service.py
from datetime import datetime
# We assume fetchSkills is in this location, as per your original file
from server.services.teams_service import fetchSkills 

def build_system_prompt(team_id: str, user_id: str, user_email: str) -> str:
    """
    Constructs the system prompt, injecting team skills context.
    """
    
    # 1. Get the current date
    current_date = datetime.now().strftime("%Y-%m-%d")
    base_system_message = f'You are ChatGPT also known as ChatGPT, a large language model trained by OpenAI. Strictly follow the users instructions. Knowledge cutoff: 2021-09-01 Current date: {current_date}'

    # 2. Define the critical team skills context
    team_skills_context = "\n\n--- CRITICAL CONTEXT: TEAM SKILLS ---\n" \
                          "You are an AI assistant for a specific team. Below is a list of your team members and their skills. " \
                          "**THIS IS YOUR MOST IMPORTANT KNOWLEDGE.**\n" \
                          "BEFORE answering any query about skills, programming, tools, or learning a topic (like 'React', 'Python', 'Docker', etc.), " \
                          "you MUST FIRST check this list. If the user's query matches a skill in this list, your PRIMARY response " \
                          "MUST be to identify the team member(s) who have that skill and suggest the user approach them.\n" \
                          "DO NOT provide general advice or external links for a topic if a team member is listed with that skill. " \
                          "Only provide general advice if no team member has the skill.\n\n" \
                          "Example:\n" \
                          "User: 'How do I learn React?'\n" \
                          "Your Correct Response: 'For questions about React, **user3@example.com** is the best person on our team to ask! They have it listed as one of their skills.'\n" \
                          "User: 'Who knows Docker?'\n" \
                          "Your Correct Response: 'That would be **user4@example.com**. They have experience with Docker and Kubernetes.'\n\n" \
                          "And remeber if there is user name like manu.singh then always mention name first thjen email id.\n\n" \
                          "--- Team Skills List ---\n"

    # 3. Fetch the skills and combine
    try:
        skills_data = fetchSkills(team_id) # e.g., "user1: Python, React\nuser2: Docker"
        print("Fetched team skills data:", skills_data)  # Debug print

        team_skills_context += skills_data
    except Exception as e:
        print(f"Error fetching team skills: {e}")
        team_skills_context += "[Could not load team skills data.]"

    # 4. Return the complete system message
    return base_system_message + team_skills_context