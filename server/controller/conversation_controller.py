# controllers/conversation_controller.py
from flask import request
from json import dumps
from server.services import gemini_service, prompt_service
import server.config  as config 

class ConversationController:
    def __init__(self, app):
        self.app = app
        self.gemini_key = config.GEMINI_API_KEY
        
        # Register the route
        app.add_url_rule(
            '/backend-api/v2/conversation',
            view_func=self.conversation,
            methods=['POST']
        )

    def conversation(self):
        try:
            # 1. Parse request
            json_data = request.json
            user_id = request.headers.get("X-User-ID")
            user_email = request.headers.get("X-User-Email")
            team_id = request.headers.get("X-Team-ID")
            _conversation = json_data['meta']['content']['conversation']
            prompt = json_data['meta']['content']['parts'][0]
            model = json_data.get( 'gemini-1.5-flash')
            gen_config = json_data.get('generationConfig', {})
            # print(f"Received conversation request from user_id: {user_id}")  # Debug print
            # print(f"User email: {user_email}")  # Debug print
            # print(f"Team ID: {team_id}")  # Debug print
            
            
            # Use custom API key if provided, otherwise use default
            api_key = json_data.get('api_key') or self.gemini_key

            # 2. Build System Prompt (using our service)
            system_message = prompt_service.build_system_prompt(team_id, user_id, user_email)

            # 4. Construct final conversation list
            final_conversation = [{'role': 'system', 'content': system_message}] + \
                _conversation + [prompt]

            # 5. Prepare Gemini Payload (using our service)
            payload_body = gemini_service.prepare_payload(
                final_conversation, 
                system_message,
                gen_config
            )
            # print("Prepared Payload Body:", dumps(payload_body, indent=2))  # Debug print
            # print("Using Proxy Config:", dumps(self.proxy_config, indent=2))  # Debug print
            # print("Using Model:", model)  # Debug print
            # print("Using Gemini Key:", api_key is not None)  # Debug print
            # 6. Get the streaming response (using our service)
            response = gemini_service.stream_gemini_response(
                'gemini-2.5-flash', 
                payload_body, 
                api_key, 
            )

            # 7. Check for upstream errors
            if response.status_code >= 400:
                try:
                    err = response.json()
                except Exception:
                    err = response.text
                return {
                    'successs': False,
                    'message': f'Gemini request failed: {response.status_code} {err}'
                }, response.status_code

            # 8. Process the stream (using our service)
            stream_generator = gemini_service.process_stream_events(response)
            
            return self.app.response_class(stream_generator, mimetype='text/event-stream')

        except Exception as e:
            print(f"Error in conversation controller: {e}")
            print(e.__traceback__.tb_next)
            return {
                '_action': '_ask',
                'success': False,
                "error": f"an error occurred {str(e)}"
            }, 400