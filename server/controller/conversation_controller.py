# controllers/conversation_controller.py
from flask import request
from json import dumps
from server.services import gemini_service, prompt_service, search_service
import server.config  as config # Our new config file

class ConversationController:
    def __init__(self, app):
        self.app = app
        self.gemini_key = config.GEMINI_API_KEY
        self.proxy_config = config.PROXY_CONFIG
        self.special_instructions = config.special_instructions
        
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
            jailbreak = json_data.get('jailbreak', 'default')
            internet_access = json_data['meta']['content']['internet_access']
            _conversation = json_data['meta']['content']['conversation']
            prompt = json_data['meta']['content']['parts'][0]
            model = json_data.get( 'gemini-1.5-flash')
            gen_config = json_data.get('generationConfig', {})

            # 2. Build System Prompt (using our service)
            system_message = prompt_service.build_system_prompt()

            # 3. Perform Internet Search if needed (using our service)
            extra_messages = []
            if internet_access:
                extra_messages = search_service.perform_internet_search(
                    prompt["content"], 
                    self.proxy_config
                )

            # 4. Construct final conversation list
            final_conversation = [{'role': 'system', 'content': system_message}] + \
                extra_messages + self.special_instructions.get(jailbreak, []) + \
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
            # print("Using Gemini Key:", self.gemini_key is not None)  # Debug print
            # 6. Get the streaming response (using our service)
            gpt_resp = gemini_service.stream_gemini_response(
                'gemini-2.5-flash', 
                payload_body, 
                self.gemini_key, 
                self.proxy_config
            )

            # 7. Check for upstream errors
            if gpt_resp.status_code >= 400:
                try:
                    err = gpt_resp.json()
                except Exception:
                    err = gpt_resp.text
                return {
                    'successs': False,
                    'message': f'Gemini request failed: {gpt_resp.status_code} {err}'
                }, gpt_resp.status_code

            # 8. Process the stream (using our service)
            stream_generator = gemini_service.process_stream_events(gpt_resp)
            
            return self.app.response_class(stream_generator, mimetype='text/event-stream')

        except Exception as e:
            print(f"Error in conversation controller: {e}")
            print(e.__traceback__.tb_next)
            return {
                '_action': '_ask',
                'success': False,
                "error": f"an error occurred {str(e)}"
            }, 400