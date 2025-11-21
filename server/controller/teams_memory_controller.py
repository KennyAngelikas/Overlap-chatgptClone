from flask import request

# Simple in-memory teams store (Option 2)
TEAMS = {}
_NEXT_ID = 1


def _next_id():
    global _NEXT_ID
    v = _NEXT_ID
    _NEXT_ID += 1
    return v


class TeamsMemoryController:
    def __init__(self, app):
        self.app = app
        app.add_url_rule('/backend-api/v2/teams_memory', view_func=self.create_team, methods=['POST'])
        app.add_url_rule('/backend-api/v2/teams_memory/join', view_func=self.join_team, methods=['POST'])
        app.add_url_rule('/backend-api/v2/teams_memory', view_func=self.list_teams, methods=['GET'])

    def create_team(self):
        try:
            data = request.json or {}
            name = data.get('team_name')
            raw_limit = data.get('member_limit')
            member_limit = None
            if raw_limit is not None:
                try:
                    member_limit = int(raw_limit)
                    if member_limit < 1:
                        raise ValueError()
                except Exception:
                    return {'success': False, 'error': 'member_limit must be a positive integer'}, 400
            if not name:
                return {'success': False, 'error': 'team_name required'}, 400
            tid = _next_id()
            TEAMS[tid] = { 'id': tid, 'name': name, 'members': {}, 'member_limit': member_limit }
            return {'success': True, 'team_id': tid, 'team_name': name, 'member_limit': member_limit}, 201
        except Exception as e:
            return {'success': False, 'error': str(e)}, 500

    def join_team(self):
        try:
            data = request.json or {}
            tid = data.get('team_id')
            user_key = data.get('user_key')
            user_email = data.get('user_email')
            if not tid or not user_key or not user_email:
                return {'success': False, 'error': 'team_id, user_key, user_email required'}, 400
            tid = int(tid)
            t = TEAMS.get(tid)
            if not t:
                return {'success': False, 'error': 'team not found'}, 404
            t['members'][user_key] = user_email
            return {'success': True}, 200
        except Exception as e:
            return {'success': False, 'error': str(e)}, 500

    def list_teams(self):
        try:
            return {'success': True, 'teams': list(TEAMS.values())}, 200
        except Exception as e:
            return {'success': False, 'error': str(e)}, 500
