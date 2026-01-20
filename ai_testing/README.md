# PromptStyler AI Testing Pipeline

Automated testing pipeline for evaluating PromptStyler's prompt refinement quality.

## Architecture

```mermaid
flowchart LR
    A[Groq Llama 3.3 70B] -->|Generate raw prompt| B[Groq Llama 3.3 70B]
    B -->|Apply style| C[Groq Llama 3.3 70B]
    C -->|Rate output| D[JSONL Training Data]
```

## Components

| Component | Provider | Model | Purpose |
|-----------|----------|-------|---------|
| **Task Generator** | Groq | Llama 3.3 70B | Creates raw user prompts |
| **Prompt Styler** | Groq | Llama 3.3 70B | Applies 7 different styles |
| **Quality Rater** | Groq | Llama 3.3 70B | Scores outputs 1-10 |

## Setup

1. Get a free Groq API key at https://console.groq.com/keys
2. Set environment variable:
   ```bash
   # Windows
   set GROQ_API_KEY=gsk_your_key_here
   
   # Linux/Mac
   export GROQ_API_KEY=gsk_your_key_here
   ```

## Usage

### Full Pipeline
```bash
python judge_rater_ai.py 50  # Generate 50 tasks × 7 styles = 350 samples
```

### Test Individual Styles
```bash
python promptstyler.py
```

### Extension Performance Test
```bash
python test_extension.py
```

## Output

Results are saved to `output/training_data.jsonl`:
```json
{"input": "raw prompt", "output": "styled prompt", "style": "markdown", "label": "DO", "score": 8.5}
```

## Rate Limits

Groq free tier: 14,400 requests/day, 500K tokens/day

| Component | Avg Time | Notes |
|-----------|----------|-------|
| Groq | ~0.5s | Ultra-fast inference |

## Files

- `config.py` - API configuration and constants
- `groq_client.py` - Groq API wrapper
- `promptstyler.py` - Style application logic
- `judge_rater_ai.py` - Full pipeline orchestrator
- `test_extension.py` - Performance benchmarks
