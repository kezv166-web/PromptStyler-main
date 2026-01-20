# PromptStyler AI Testing Pipeline - Configuration

import os

# ============================================
# GROQ API (For all AI calls)
# ============================================
# Set your API key as environment variable: GROQ_API_KEY
# Get your free API key at: https://console.groq.com
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

# Rate limiting for Groq (14,400 requests/day = ~10 req/min to be safe)
GROQ_DELAY_MS = 100  # Minimal delay, Groq is fast

# ============================================
# PROMPTSTYLER STYLES (from popup.js)
# ============================================
STYLES = [
    {"name": "professional", "description": "Concise, professional instruction"},
    {"name": "markdown", "description": "Structured with ## sections"},
    {"name": "json", "description": "Strict JSON format"},
    {"name": "toon", "description": "Token-Oriented Object Notation"},
    {"name": "persona", "description": "Role-based prompt"},
    {"name": "cot", "description": "Chain-of-Thought with reasoning"},
    {"name": "fewshot", "description": "Pattern-based with examples"}
]

# ============================================
# TASK CATEGORIES
# ============================================
TASK_CATEGORIES = {
    "coding": 200,
    "writing": 150,
    "research": 150,
    "data": 100,
    "creative": 100,
    "business": 100,
    "education": 100,
    "misc": 100
}

# ============================================
# SCORING
# ============================================
RATING_CRITERIA = ["clarity", "structure", "completeness", "style_compliance", "token_efficiency", "actionability"]
DO_THRESHOLD = 7.0      # Score >= 7.0 = DO example
DONT_THRESHOLD = 5.0    # Score < 5.0 = strong DON'T example

# ============================================
# OUTPUT PATHS
# ============================================
OUTPUT_DIR = "output"
TRAINING_DATA_FILE = f"{OUTPUT_DIR}/training_data.jsonl"
