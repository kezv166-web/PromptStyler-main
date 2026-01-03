# Pipeline - PromptStyler AI Testing
# Groq (generation) → Pollinations (style) → Pollinations (rate)

import os
import json
import argparse
from config import OUTPUT_DIR, TRAINING_DATA_FILE

def run_pipeline(count: int = 10):
    """Run the AI testing pipeline."""
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("="*60)
    print("PROMPTSTYLER AI TESTING PIPELINE")
    print("="*60)
    print(f"Generator: Groq Llama 70B (2 sec rate limit)")
    print(f"Styler: Pollinations OpenAI (seed=42)")
    print(f"Rater: Pollinations OpenAI (no seed)")
    print(f"Output: {TRAINING_DATA_FILE}")
    print("="*60)
    
    from judge_rater_ai import JudgeRaterAI
    
    ai = JudgeRaterAI()
    total_lines = ai.run_batch(count, TRAINING_DATA_FILE)
    
    # Summary
    do_count = 0
    with open(TRAINING_DATA_FILE, "r") as f:
        for line in f:
            data = json.loads(line)
            if data.get("label") == "DO":
                do_count += 1
    
    print("\n" + "="*60)
    print("COMPLETE")
    print("="*60)
    print(f"Tasks: {count}")
    print(f"Training samples: {total_lines}")
    print(f"DO: {do_count} | DONT: {total_lines - do_count}")
    print(f"File: {TRAINING_DATA_FILE}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", "-n", type=int, default=10)
    args = parser.parse_args()
    run_pipeline(args.count)
