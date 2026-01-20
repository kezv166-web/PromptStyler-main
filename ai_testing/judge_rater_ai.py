# Judge + Rater Agent
# Uses Groq API for all AI calls (generation, styling, rating)

import os
import json
import random
import requests
from groq_client import get_client as get_groq
from config import STYLES, TASK_CATEGORIES, RATING_CRITERIA, DO_THRESHOLD, GROQ_API_URL, GROQ_MODEL, GROQ_API_KEY, OUTPUT_DIR
from promptstyler import apply_style

CHECKPOINT_INTERVAL = 20

class JudgeRaterAI:
    """
    Unified Groq pipeline:
    1. Generate raw prompts (Groq)
    2. Apply styles (Groq via promptstyler) 
    3. Rate outputs (Groq)
    """
    
    def __init__(self, groq_key: str = None):
        self.groq = get_groq(groq_key)
        self.api_key = groq_key or GROQ_API_KEY
        self.styles = [s["name"] for s in STYLES]
        self.categories = list(TASK_CATEGORIES.keys())
    
    def generate_task(self, category: str, difficulty: str = "medium") -> dict:
        """Generate raw prompt using Groq."""
        
        prompt = f"""Generate a raw, unstructured user prompt for testing AI prompt styling.

Category: {category}
Difficulty: {difficulty}

CRITICAL: Humans write prompts in MANY different styles. Pick ONE style randomly:

1. DIRECT COMMAND: "Make a website for my bakery"
2. QUESTION: "what's the best way to learn python?"
3. INCOMPLETE: "python script sorting... maybe with pandas?"
4. CASUAL/MESSY: "yo so like i need help with this thing where..."
5. FORMAL: "I would like assistance with creating a presentation."
6. FRUSTRATED: "ugh this code keeps breaking, how do i fix arrays"
7. DETAILED: "I have a CSV with 3 columns: name, age, salary. Need to filter rows where age > 30"
8. VAGUE: "something for my project"
9. TYPOS: "i ned help wiht my esay about climte change"
10. MIXED: "Can someone help... basically I want to build an app but idk where to start tbh"

EXAMPLES:
- "explain machine learning"
- "im stuck on this regex thing can u help"
- "Write me a function that takes two numbers and returns the bigger one"
- "so my boss wants a report on Q3 sales and I have no idea how to make charts in excel..."
- "URGENT need to fix this bug before demo!!!"
- "how do databases work exactly? like the basics"
- "build me a todo app"
- "whats wrong with this: for i in range(10) print(i)"

Rules:
- Write like a REAL human (vary style, length, formality)
- NEVER start with "I want" or "I need" every time
- Typos and grammar mistakes are OK
- Do NOT mention formats (json, markdown, etc)
- Length: 10-100 words

Output ONLY the raw prompt text, nothing else."""

        raw_prompt = self.groq.generate(prompt, temperature=0.95)
        
        return {
            "category": category,
            "difficulty": difficulty,
            "raw_prompt": raw_prompt
        }
    
    def rate_output(self, raw_prompt: str, style: str, styled_output: str) -> dict:
        """Rate using Groq API."""
        
        rating_prompt = f"""Rate this styled prompt quality objectively.

ORIGINAL: {raw_prompt}
STYLE: {style}
OUTPUT: {styled_output}

Rate 1-10: clarity, structure, completeness, style_compliance, token_efficiency, actionability

Return ONLY JSON:
{{"clarity":N,"structure":N,"completeness":N,"style_compliance":N,"token_efficiency":N,"actionability":N,"overall":N,"verdict":"DO/DONT","feedback":"..."}}"""

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": GROQ_MODEL,
            "messages": [{"role": "user", "content": rating_prompt}],
            "temperature": 0.3,
            "max_tokens": 500
        }
        
        try:
            response = requests.post(
                GROQ_API_URL,
                headers=headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                text = data["choices"][0]["message"]["content"].strip()
                if "{" in text:
                    start = text.find("{")
                    end = text.rfind("}") + 1
                    result = json.loads(text[start:end])
                    
                    if "overall" not in result:
                        scores = [result.get(c, 5) for c in RATING_CRITERIA]
                        result["overall"] = round(sum(scores) / len(scores), 1)
                    
                    result["verdict"] = "DO" if result.get("overall", 0) >= DO_THRESHOLD else "DONT"
                    return result
        except Exception as e:
            print(f"  Rating error: {e}")
        
        return {"error": "Rating failed", "overall": 0, "verdict": "DONT"}
    
    def process_task(self, task_id: int) -> dict:
        """Process one task with all 7 styles."""
        
        category = random.choice(self.categories)
        difficulty = random.choice(["easy", "medium", "hard"])
        
        print(f"\n[Task {task_id}] Generating {category} prompt (Groq)...")
        task = self.generate_task(category, difficulty)
        
        if not task["raw_prompt"]:
            return {"error": "Failed to generate", "task_id": task_id}
        
        print(f"  Raw: {task['raw_prompt'][:50]}...")
        
        style_results = []
        for style in self.styles:
            print(f"  [{style}] Styling...")
            styled = apply_style(task["raw_prompt"], style, api_key=self.api_key)
            
            if styled:
                print(f"  [{style}] Rating...")
                rating = self.rate_output(task["raw_prompt"], style, styled)
                style_results.append({
                    "style": style,
                    "styled_output": styled,
                    "rating": rating
                })
            else:
                style_results.append({"style": style, "error": "Failed"})
        
        return {
            "task_id": task_id,
            "category": category,
            "difficulty": difficulty,
            "raw_prompt": task["raw_prompt"],
            "style_results": style_results
        }
    
    def run_batch(self, count: int, output_file: str) -> int:
        """Run batch and save as flat JSONL."""
        
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
        print(f"\nProcessing {count} tasks")
        print(f"Generator: Groq {GROQ_MODEL}")
        print(f"Styles: {', '.join(self.styles)}")
        print(f"Format: JSONL\n")
        
        with open(output_file, "a", encoding="utf-8") as f:
            for i in range(count):
                result = self.process_task(i + 1)
                
                raw = result.get("raw_prompt", "")
                category = result.get("category", "")
                
                for sr in result.get("style_results", []):
                    if "error" not in sr:
                        line = {
                            "input": raw,
                            "output": sr.get("styled_output", ""),
                            "style": sr.get("style", ""),
                            "label": sr.get("rating", {}).get("verdict", "DONT"),
                            "score": sr.get("rating", {}).get("overall", 0),
                            "category": category
                        }
                        f.write(json.dumps(line, ensure_ascii=False) + "\n")
                        f.flush()
                
                ok = len([s for s in result.get("style_results", []) if "error" not in s])
                print(f"  → {ok}/7 written\n")
        
        with open(output_file, "r") as f:
            total = sum(1 for _ in f)
        
        print(f"Saved {total} samples to {output_file}")
        return total


if __name__ == "__main__":
    import sys
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    ai = JudgeRaterAI()
    ai.run_batch(count, "output/training_data.jsonl")
