# services/gemini_service.py
import requests
from json import dumps, loads
import server.config  as config # Our new config file


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


def stream_gemini_response(model: str, body: dict, gemini_key: str, proxies: dict = None):
    """
    Calls the Gemini API and returns a streaming response object.
    Handles 404 retry logic.
    """
    session = requests.Session()
    session.trust_env = False
    
    proxy_dict = None
    if proxies and proxies.get('enable'):
        proxy_dict = {
            'http': proxies.get('http'),
            'https': proxies.get('https'),
        }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse"
    headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': gemini_key
    }

    gpt_resp = session.post(
        url,
        headers=headers,
        json=body,
        proxies=proxy_dict,
        stream=True,
        timeout=60,
    )

    # 404 Retry Logic
    if gpt_resp.status_code == 404 and model != config.GEMINI_FALLBACK_MODEL:
        print(f"Gemini model {model} not found (404). Retrying with {config.GEMINI_FALLBACK_MODEL}")
        
        fallback_url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_FALLBACK_MODEL}:streamGenerateContent?alt=sse"
        gpt_resp = session.post(
            fallback_url,
            headers=headers,
            json=body,
            proxies=proxy_dict,
            stream=True,
            timeout=60,
        )

    return gpt_resp


def process_stream_events(gpt_resp):
    """
    A generator that processes the raw SSE stream from Gemini
    and yields JSON-formatted data chunks.
    """
    try:
        for raw_line in gpt_resp.iter_lines(decode_unicode=True):
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