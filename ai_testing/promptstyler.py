# PromptStyler Simulator
# Replicates the extension's behavior using Pollinations AI

import time
import requests
from config import POLLINATIONS_API_URL, STYLES

POLLINATIONS_DELAY_MS = 500  # Rate limit delay

# System prompt from popup.js - with CORRECT TOON format
SYSTEM_PROMPT = """You are "PromptStyler", an advanced prompt-refinement system designed to transform unstructured or unclear user prompts into clean, professional, task-optimized prompts.

Your goals:
1. Improve clarity, structure, and precision.
2. Preserve the original meaning of the user's intent.
3. Apply the user-selected prompt style strictly.
4. Never introduce new tasks, assumptions, or extra context.
5. Always keep the rewritten prompt ready for direct use in an LLM.

STRICT RULES:
- Do NOT change or reinterpret the user's task.
- Do NOT add recommendations, analysis, or commentary.
- Do NOT include explanations about what you did.
- Only output the final rewritten prompt in the required style.

SUPPORTED STYLES:

1. PROFESSIONAL: Concise, professional instruction. Task-oriented, clear tone.

2. MARKDOWN: Use ## Task, ## Context, ## Requirements, ## Output Format sections.

3. JSON: Valid JSON with task, context, constraints, output_format fields.

4. TOON (Token-Oriented Object Notation):
   TOON is a TOKEN-EFFICIENT format. Key difference from YAML:
   - NO quotes, minimal braces
   - Horizontal, compact format
   - Arrays use tabular syntax: name[count]{fields}: row1 row2...
   
   RULES:
   - Simple object: key: value key2: value2 (space-separated on ONE line)
   - Nested: use indentation
   - Primitive array: tags[3]: red,green,blue
   - Object array (TABULAR): users[2]{id,name}: 1,Alice 2,Bob (one row per line after colon)
   
   EXAMPLE - JSON:
   { "task": "summarize", "input": "document.pdf", "constraints": ["max 5 bullets", "simple language"] }
   
   EXAMPLE - TOON (same data):
   task: summarize input: document.pdf
   constraints[2]: max 5 bullets,simple language
   
   EXAMPLE - Complex TOON:
   task: analyze data
   options: format: csv limit: 100
   columns[3]{name,type}: id,int name,string score,float

5. PERSONA: Add role description at top (e.g., "You are a senior expert...").

6. COT (Chain-of-Thought):
   Structure the prompt to encourage implicit logical flow WITHOUT asking for explicit reasoning.
   - Break complex tasks into clear sub-questions or steps
   - Use phrases like "Consider...", "First... Then...", "Given X, determine Y"
   - End with "### Final Answer" to ensure clean output
   - Do NOT say "show your reasoning" or "think step-by-step"
   
   EXAMPLE:
   Task: [main goal]
   Consider: [key factor 1]
   Then: [key factor 2]  
   Given these, [specific question]
   ### Final Answer

7. FEWSHOT: Pattern-based with 1-3 examples, then "Now continue this pattern..."

OUTPUT: Only the final rewritten prompt in the selected style, nothing else."""


last_request_time = 0

def apply_style(raw_prompt: str, style: str, max_retries: int = 3) -> str:
    """
    Apply a style to a raw prompt using Pollinations AI.
    Simulates the PromptStyler extension behavior.
    Includes retry logic with exponential backoff.
    """
    global last_request_time
    
    # Rate limiting
    elapsed_ms = (time.time() * 1000) - last_request_time
    if elapsed_ms < POLLINATIONS_DELAY_MS:
        time.sleep((POLLINATIONS_DELAY_MS - elapsed_ms) / 1000)
    last_request_time = time.time() * 1000
    
    # Construct prompt like popup.js does
    full_prompt = f"{SYSTEM_PROMPT}\n\nStyle: {style.upper()}\n\nUser Input:\n{raw_prompt}"
    
    payload = {
        "messages": [{"role": "user", "content": full_prompt}],
        "model": "openai",
        "seed": 42
    }
    
    # Retry logic with exponential backoff
    for attempt in range(max_retries):
        try:
            response = requests.post(
                POLLINATIONS_API_URL,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=60  # Increased from 30s
            )
            
            if response.status_code == 200:
                return response.text.strip()
            else:
                print(f"Pollinations Error {response.status_code} (attempt {attempt + 1}/{max_retries})")
                
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
    
    for style in ["professional", "markdown", "json"]:
        print(f"\n{'='*50}")
        print(f"Style: {style.upper()}")
        print(f"{'='*50}")
        result = apply_style(test_prompt, style)
        print(result)
