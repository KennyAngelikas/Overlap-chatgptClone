import sys
from typing import List, Dict, Any, Optional
from psycopg2.extras import Json
from server.model.db_model import get_db_cursor

def ensure_team_table():
    """Create the team_skills table if it does not exist and ensure new columns are present."""
    with get_db_cursor(dict_cursor=False) as (conn, cur):
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS team_skills (
                team_id SERIAL PRIMARY KEY,
                team_name TEXT,
                user_id JSONB DEFAULT '{}'::jsonb,
                soft_skills JSONB DEFAULT '{}'::jsonb,
                hard_skills JSONB DEFAULT '{}'::jsonb
            );
            """
        )
        # Add new columns safely if an older table already exists
        cur.execute("ALTER TABLE team_skills ADD COLUMN IF NOT EXISTS member_limit INTEGER;")


def get_team_skills_data(team_id: str) -> List[Dict[str, Any]]:
    """Fetch all teams from the database. Returns an empty list on error."""
    try:
        ensure_team_table()
        with get_db_cursor(dict_cursor=True) as (conn, cur):
            # CHANGE: Use %s instead of ? for PostgreSQL
            cur.execute("SELECT * FROM team_skills WHERE team_id = %s", (team_id,))
            rows = cur.fetchall() or []
            return rows
    except Exception as e:
        print(f"Error fetching team skills data: {e}", file=sys.stderr)
        return []


def create_team(team_name: str, member_limit: Optional[int] = None) -> Optional[int]:
    """Insert a new team and return its team_id."""
    try:
        ensure_team_table()
        with get_db_cursor(dict_cursor=True) as (conn, cur):
            cur.execute(
                """
                INSERT INTO team_skills (team_name, user_id, soft_skills, hard_skills, member_limit)
                VALUES (%s, %s, %s, %s, %s) RETURNING team_id;
                """,
                (team_name, Json({}), Json({}), Json({}), member_limit)
            )
            row = cur.fetchone()
            return row.get('team_id') if row else None
    except Exception as e:
        print(f"Error creating team: {e}", file=sys.stderr)
        return None


def list_teams() -> List[Dict[str, Any]]:
    """Fetch all teams from the database. Returns an empty list on error."""
    try:
        with get_db_cursor(dict_cursor=True) as (conn, cur):
            cur.execute("SELECT * FROM team_skills;")
            rows = cur.fetchall() or []
            return rows
    except Exception as e:
        print(f"Error fetching team skills data: {e}", file=sys.stderr)
        return []



def add_member(team_id: int, user_key: str, user_email: str) -> bool:
    """
    Add a user to a team. Returns True if successful or already a member.
    Returns False if team not found or full.
    """
    try:
        ensure_team_table()
        with get_db_cursor(dict_cursor=True) as (conn, cur):
            # 1. Fetch current team data
            cur.execute("SELECT user_id, member_limit FROM team_skills WHERE team_id = %s;", (team_id,))
            row = cur.fetchone()
            if not row:
                return False
            
            current_members = row.get('user_id') or {}
            limit = row.get('member_limit')
            
            # 2. Check if already a member
            if user_key in current_members:
                # Update email just in case
                if current_members[user_key] != user_email:
                    current_members[user_key] = user_email
                    cur.execute(
                        "UPDATE team_skills SET user_id = %s WHERE team_id = %s;",
                        (Json(current_members), team_id)
                    )
                return True
            
            # 3. Check limit
            if limit is not None and len(current_members) >= limit:
                return False

            # 4. Add member
            current_members[user_key] = user_email
            cur.execute(
                "UPDATE team_skills SET user_id = %s WHERE team_id = %s;",
                (Json(current_members), team_id)
            )
            return True
    except Exception as e:
        print(f"Error adding member: {e}", file=sys.stderr)
        return False
