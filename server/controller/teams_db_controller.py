import json
from flask import request
from server.model.teams_model import create_team, list_teams


class TeamsDBController:
    def __init__(self, app):
        self.app = app
        app.add_url_rule('/backend-api/v2/teams', view_func=self.create_team, methods=['POST'])
        app.add_url_rule('/backend-api/v2/teams/join', view_func=self.join_team, methods=['POST'])
        app.add_url_rule('/backend-api/v2/teams', view_func=self.list_teams, methods=['GET'])

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
            team_id = create_team(name, member_limit)
            if team_id is None:
                return {'success': False, 'error': 'could not create team'}, 500
            return {'success': True, 'team_id': team_id, 'team_name': name, 'member_limit': member_limit}, 201
        except Exception as e:
            return {'success': False, 'error': str(e)}, 500

    def join_team(self):
        try:
            data = request.json or {}
            team_id = data.get('team_id')
            user_key = data.get('user_key')
            user_email = data.get('user_email')
            if not team_id or not user_key or not user_email:
                return {'success': False, 'error': 'team_id, user_key and user_email required'}, 400
            ok = add_member(int(team_id), user_key, user_email)
            if not ok:
                return {'success': False, 'error': 'could not add member'}, 500
            return {'success': True}, 200
        except Exception as e:
            return {'success': False, 'error': str(e)}, 500

    def list_teams(self):
        try:
            teams = list_teams()
            return {'success': True, 'teams': teams}, 200
        except Exception as e:
            return {'success': False, 'error': str(e)}, 500
