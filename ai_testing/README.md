# PromptStyler AI Testing Pipeline

Automated testing system that generates training data for the PromptStyler Chrome extension.

## Architecture

```mermaid
flowchart LR
    A[Groq Llama 3.3 70B] -->|Generate raw prompt| B[Pollinations OpenAI]
    B -->|Apply 7 styles| C[Groq Llama 3.3 70B]
    C -->|Rate each output| D[training_data.json]
```

## AI Roles

| Role | Provider | Model | Purpose |
|------|----------|-------|---------|
| **Task Generator** | Groq | Llama 3.3 70B | Creates realistic raw prompts |
| **Prompt Styler** | Pollinations | OpenAI | Applies 7 different styles |
| **Quality Rater** | Groq | Llama 3.3 70B | Scores each styled output 1-10 |

## Pipeline Flow

### Step 1: Generate Raw Prompt
Groq generates a messy, realistic user prompt like:
> "create a simple python script that calculates the average of numbers"

### Step 2: Apply ALL 7 Styles
Each raw prompt goes through PromptStyler simulator with all styles:

| Style | Description |
|-------|-------------|
| Professional | Concise, task-oriented |
| Markdown | Structured with `##` sections |
| JSON | Valid JSON with task/context/constraints |
| TOON | Token-efficient YAML+CSV hybrid |
| Persona | Role-based ("You are an expert...") |
| CoT | Implicit reasoning structure |
| Few-shot | Pattern-based with examples |

### Step 3: Rate Each Output
Groq rates each styled output on 6 criteria (1-10):
- Clarity, Structure, Completeness
- Style compliance, Token efficiency, Actionability

**Verdict**: Score ≥ 7.0 = **DO** ✅ | Score < 7.0 = **DON'T** ❌

### Step 4: Save to Single File
All results saved to `output/training_data.json`

## Output Format

```json
{
  "task_id": 1,
  "category": "coding",
  "raw_prompt": "create a simple python script...",
  "style_results": [
    {
      "style": "professional",
      "styled_output": "Write a Python script that...",
      "rating": {
        "clarity": 9, "structure": 9, "overall": 8.7,
        "verdict": "DO"
      }
    },
    // ... 6 more styles
  ]
}
```

## Files

| File | Purpose |
|------|---------|
| `config.py` | API keys, thresholds, style definitions |
| `groq_client.py` | Groq API wrapper with rate limiting |
| `promptstyler.py` | PromptStyler extension simulator |
| `judge_rater_ai.py` | Task generation + quality rating |
| `pipeline.py` | Main orchestrator |

## Rate Limiting

| API | Delay | Reason |
|-----|-------|--------|
| Groq | 2s | 30 req/min free tier |
| Pollinations | 0.5s | No strict limit |

## Usage

```bash
# Generate 1000 prompts × 7 styles = 7000 samples
python pipeline.py --count 1000
```

## Current Run

- **Started**: 2025-12-31 12:08
- **Target**: 1000 raw prompts × 7 styles = 7000 training samples
- **Output**: `output/training_data.json`
- **Checkpoints**: Every 50 tasks
