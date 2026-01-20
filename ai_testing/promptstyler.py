# PromptStyler Simulator
# Uses shared system prompt from shared/system_prompt.py

import os
import sys
import time
import requests

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import GROQ_API_KEY, GROQ_API_URL, GROQ_MODEL, GROQ_DELAY_MS, STYLES
from shared.system_prompt import SYSTEM_PROMPT

last_request_time = 0

def apply_style(raw_prompt: str, style: str, max_retries: int = 3, api_key: str = None) -> str:
    """
    Apply a style to a raw prompt using Groq AI.
    Simulates the PromptStyler extension behavior.
    Includes retry logic with exponential backoff.
    """
    global last_request_time
    
    # Use provided key or fall back to environment variable
    key = api_key or GROQ_API_KEY
    if not key:
        print("Error: No Groq API key provided. Set GROQ_API_KEY environment variable.")
        return None
    
    # Rate limiting
    elapsed_ms = (time.time() * 1000) - last_request_time
    if elapsed_ms < GROQ_DELAY_MS:
        time.sleep((GROQ_DELAY_MS - elapsed_ms) / 1000)
    last_request_time = time.time() * 1000
    
    # Construct prompt like popup.js does
    user_prompt = f"Style: {style.upper()}\n\nUser Input:\n{raw_prompt}"
    
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 2048
    }
    
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    
    # Retry logic with exponential backoff
    for attempt in range(max_retries):
        try:
            response = requests.post(
                GROQ_API_URL,
                headers=headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                return data["choices"][0]["message"]["content"].strip()
            elif response.status_code == 429:
                print(f"Rate limited (attempt {attempt + 1}/{max_retries})")
            else:
                print(f"Groq Error {response.status_code} (attempt {attempt + 1}/{max_retries})")
                
        except requests.exceptions.Timeout:
            print(f"Timeout (attempt {attempt + 1}/{max_retries})")
        except Exception as e:
            print(f"Request failed: {e} (attempt {attempt + 1}/{max_retries})")
        
        # Exponential backoff before retry
        if attempt < max_retries - 1:
            wait_time = 2 ** attempt
            print(f"Retrying in {wait_time}s...")
            time.sleep(wait_time)
    
    return None


def get_style_info(style_name: str) -> dict:
    """Get style information."""
    for style in STYLES:
        if style["name"].lower() == style_name.lower():
            return style
    return None


# Test
if __name__ == "__main__":
    test_prompt = "write python code to sort a list"
    
    for style in ["professional", "markdown", "json", "toon"]:
        print(f"\n{'='*50}")
        print(f"Style: {style.upper()}")
        print(f"{'='*50}")
        result = apply_style(test_prompt, style)
        print(result)
