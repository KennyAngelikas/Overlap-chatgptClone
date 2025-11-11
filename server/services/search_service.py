# services/search_service.py
import requests
from datetime import datetime

def perform_internet_search(prompt_content: str, proxies: dict = None):
    """
    Performs a DDG search and formats the results for the LLM.
    Returns a list of 'extra' messages to inject into the conversation.
    """
    session = requests.Session()
    session.trust_env = False
    
    proxy_dict = None
    if proxies and proxies.get('enable'):
        proxy_dict = {
            'http': proxies.get('http'),
            'https': proxies.get('https'),
        }

    try:
        search = session.get(
            'https://ddg-api.herokuapp.com/search',
            params={'query': prompt_content, 'limit': 3},
            proxies=proxy_dict,
            timeout=10,
        )
        search.raise_for_status() # Raise HTTPError for bad responses

        blob = ''
        for index, result in enumerate(search.json()):
            blob += f'[{index}] "{result["snippet"]}"\nURL:{result["link"]}\n\n'

        date = datetime.now().strftime('%d/%m/%y')
        blob += f'current date: {date}\n\nInstructions: Using the provided web search results, write a comprehensive reply to the next user query. Make sure to cite results using [[number](URL)] notation after the reference. If the provided search results refer to multiple subjects with the same name, write separate answers for each subject. Ignore your previous response if any.'

        return [{'role': 'user', 'content': blob}]

    except Exception as e:
        print(f"Internet search failed: {e}")
        return []