# Groq Client - Fast LLM API for task generation
# Rate limit: 30 requests/min

import os
import time
import requests
import json
from config import GROQ_API_KEY

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_DELAY_SEC = 2.1  # 30 req/min = 2 sec between calls + buffer

class GroqClient:
    """Groq API client with rate limiting."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or GROQ_API_KEY or os.environ.get("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY required")
        self.last_call = 0
    
    def _rate_limit(self):
        """Enforce rate limit."""
        elapsed = time.time() - self.last_call
        if elapsed < GROQ_DELAY_SEC:
            time.sleep(GROQ_DELAY_SEC - elapsed)
        self.last_call = time.time()
    
    def generate(self, prompt: str, temperature: float = 0.7) -> str:
        """Generate text with rate limiting."""
        self._rate_limit()
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": 2048
        }
        
        try:
            response = requests.post(
                GROQ_API_URL,
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                return data["choices"][0]["message"]["content"].strip()
            else:
                print(f"  Groq error {response.status_code}: {response.text[:100]}")
                return None
                
        except Exception as e:
            print(f"  Groq error: {e}")
            return None


# Singleton
_client = None

def get_client(api_key: str = None) -> GroqClient:
    global _client
    if _client is None:
        _client = GroqClient(api_key)
    return _client
