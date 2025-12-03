###📋 API Data Contract 
1. teams_model.py
The model returns a list of Team objects. Even if you fetch a single team, it will be inside a list.

Each Team object in the list will have the following structure:

```json
[
  {
    "team_id": 1000,
    "user_id": {
      "user1": "user1@example.com",
      "user2": "user2@example.com"
    },
    "soft_skills": {
      "user1": ["Communication", "Leadership"],
      "user2": ["Problem Solving", "Negotiation"]
    },
    "hard_skills": {
      "user1": {
        "tools": ["Git", "Jira"],
        "programming": ["Python", "SQL"]
      },
      "user2": {
        "tools": ["Azure DevOps"],
        "programming": ["Java", "C#"]
      }
    }
  }
]

user -- firebase
- id 
- skills (option 1: gemini save it, **option 2: hard code**)

team -- 
  team members

```
#Field Descriptions
team_id (Integer): The unique numeric ID for the team.

user_id (Object): A dictionary (object) where each key is an internal user identifier (e.g., "user1") and the value is the user's email address (String).

soft_skills (Object): A dictionary where each key matches a user identifier from the user_id object. The value for each user is a list of strings representing their soft skills.

hard_skills (Object): A dictionary where each key matches a user identifier from the user_id object. The value is another object containing:

tools (List): A list of strings for the user's technical tools.

programming (List): A list of strings for the user's programming languages and frameworks.