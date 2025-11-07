#Database module for model config and management

import os
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

#Centralized model configuration management
class ModelConfig:
    DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
    GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
    GEMINI_STREAM_ENDPOINT = 'streamGenerateContent'

    #Extracts and validates the model name from request data, normalizing it with defaults
    @static method
    def get_model_name(request_data: Dict[str, Any]) -> str:
        model = request_data.get('model', ModelConfig.DEFAULT_GEMINI_MODEL)

        # Normalize model name: handle None, convert to string, strip whitespace
        if model is None:
            return ModelConfig.DEFAULT_GEMINI_MODEL

        model_str = str(model).strip()
        return model_str if model_str else ModelConfig.DEFAULT_GEMINI_MODEL


    #Retrieves fallback model name from environment or uses default
    @static method
    def get_fallback_model() -> str:
        return os.get env('GEMINI_FALLBACK_MODEL') or ModelConfig.DEFAULT_GEMINI_MODEL


    #Constructs the Gemini API streaming endpoint URL for the given model
    @static method
    def build_gemini_url(model: str) -> str:
        return (
            f"{ModelConfig.GEMINI_API_BASE_URL}/models/{model}:"
            f"{ModelConfig.GEMINI_STREAM_ENDPOINT}?alt=sse"
        )

    #Prepares the request body for the Gemini API call with proper formatting
    @static method
    def prepare_gemini_request_body(
        contents: list,
        system_instruction: str,
        generation_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        body = {
            'contents': contents,
            'systemInstruction': {
                'parts': [{'text': system_instruction}]
            }
        }

        if generation_config:
            body['generationConfig'] = generation_config

        return body

    #Validates that a model name is non-empty and properly formatted
    @static method
    def validate_model_name(model: str) -> bool:
        if not model or not is instance(model, str):
            return False

        model_trimmed = model.strip()
        return len(model_trimmed) > 0


#Convenience wrapper for model name from request data
def get_model_from_request(request_data: Dict[str, Any]) -> str:
    return ModelConfig.get_model_name(request_data)

#Convenience wrapper for fallback model name
def get_fallback_model() -> str:
    return ModelConfig.get_fallback_model()

