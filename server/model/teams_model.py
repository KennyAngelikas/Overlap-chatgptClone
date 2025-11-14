from server.model.db_model import get_db_cursor

    
def get_team_skills_data():
    """
    Fetches all team skills from the database.
    
    Returns:
        A list of dictionaries (rows) on success, or None on failure.
    """
    print("Attempting to fetch team skills data...")
    try:
        # The context manager handles connection and cursor
        with get_db_cursor(dict_cursor=True) as (conn, cur):
            cur.execute("SELECT * FROM team_skills;")
            # .fetchall() with dict_cursor gives a list of dicts
            team_skills = cur.fetchall()
            print(f"Successfully fetched {len(team_skills)} records.")
            return team_skills
            
    except Exception as e:
        # Log the full error for debugging
        print(f"An error occurred while fetching team skills data: {e}", file=sys.stderr)
        # Return None or an empty list to indicate failure
        return None

