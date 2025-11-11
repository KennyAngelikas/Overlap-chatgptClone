from server.model.teams_model import get_team_skills_data


def fetchSkills():
    team_skills_row = get_team_skills_data()[0]
    user_ids = team_skills_row.get("user_id", {})
    soft_skills = team_skills_row.get("soft_skills", {})
    hard_skills = team_skills_row.get("hard_skills", {})

    team_skills_context = "\n\n--- CRITICAL CONTEXT: TEAM SKILLS LIST ---\n"
    for user_key, internal_id in user_ids.items():
        team_skills_context += f"User: {user_ids[user_key]} \n"
    
         # Add soft skills
        if user_key in soft_skills and soft_skills[user_key]:
            team_skills_context += f"  Soft Skills: {', '.join(soft_skills[user_key])}\n"
        
        # Add hard skills
        if user_key in hard_skills:
            user_hard_skills = hard_skills[user_key]
            hard_skill_parts = []
            if user_hard_skills.get("programming"):
                hard_skill_parts.append(f"Programming: {', '.join(user_hard_skills['programming'])}")
            if user_hard_skills.get("tools"):
                hard_skill_parts.append(f"Tools: {', '.join(user_hard_skills['tools'])}")
            
            if hard_skill_parts:
                team_skills_context += f"  Hard Skills: {'; '.join(hard_skill_parts)}\n"
            else:
                team_skills_context += "  Hard Skills: None listed\n"
    
        team_skills_context += "\n" # Add a newline for spacing between users

        team_skills_context += "--- End of Team Skills List ---\n"
    return team_skills_context

