# services/gemini_service.py
import requests
from json import dumps, loads

# This is just creating the "system" prompt with context 
def prepare_payload(conversation: list, system_message: str, generation_config: dict = None):
    """
    Maps the internal conversation format to the Gemini API format.
    """
    contents = []
    system_instruction_text = system_message # Default from prompt_service
    
    for msg in conversation:
        role = msg.get('role', 'user')
        if role == 'system':
            # Overwrite if a new system message is in the conversation
            system_instruction_text = msg.get('content', '')
            continue
        
        mapped_role = 'user' if role == 'user' else 'model'
        contents.append({
            'role': mapped_role,
            'parts': [{'text': msg.get('content', '')}]
        })
    
    body = {
        'contents': contents,
        'systemInstruction': {'parts': [{'text': system_instruction_text}]},
        'generationConfig': generation_config or {}
    }
    return body

# This function calls the Gemini API and returns the streaming response
def stream_gemini_response(model: str, body: dict, gemini_key: str):
    """
    Calls the Gemini API and returns a streaming response object.
    """
    session = requests.Session()

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse"
    headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': gemini_key
    }

    response = session.post(
        url,
        headers=headers,
        json=body,
        stream=True,
        timeout=60,
    )

    return response

# This generator processes the streaming response from Gemini
def process_stream_events(response):
    """
    A generator that processes the raw SSE stream from Gemini
    and yields JSON-formatted data chunks.
    """
    try:
        for raw_line in response.iter_lines(decode_unicode=True):
            if not raw_line:
                continue
            line = raw_line.strip()
            
            if line.startswith('data:'):
                payload_str = line.split('data:', 1)[1].strip()
                if payload_str in ('[DONE]', ''):
                    continue
                
                try:
                    payload = loads(payload_str)
                except Exception:
                    continue # Skip non-JSON data

                candidates = payload.get('candidates', [])
                for cand in candidates:
                    content = cand.get('content', {})
                    parts = content.get('parts', [])
                    for p in parts:
                        text = p.get('text')
                        if text:
                            try:
                                s = dumps({'text': text})
                            except Exception:
                                s = dumps({'text': str(text)})
                            yield f"data: {s}\n\n"
                            
    except GeneratorExit:
        return
    except Exception as e:
        print(f'Gemini stream error: {e}')
        return