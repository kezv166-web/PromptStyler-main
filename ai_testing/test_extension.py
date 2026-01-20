"""
Extension Performance Test - Uses shared system prompt
"""
import os
import sys
import requests
import json
import time

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.system_prompt import SYSTEM_PROMPT

# Groq API Configuration
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")


def test_style(prompt, style, api_key=None):
    """Test a style using the extension's API call pattern"""
    key = api_key or GROQ_API_KEY
    if not key:
        return None, 0, "No API key - set GROQ_API_KEY environment variable"
    
    user_prompt = f"Style: {style.upper()}\n\nUser Input:\n{prompt}"
    
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 2048
    }
    
    try:
        start = time.time()
        response = requests.post(
            GROQ_API_URL,
            headers=headers,
            json=payload,
            timeout=60
        )
        elapsed = time.time() - start
        
        if response.status_code == 200:
            data = response.json()
            return data["choices"][0]["message"]["content"].strip(), elapsed, None
        elif response.status_code == 401:
            return None, elapsed, "Invalid API key"
        elif response.status_code == 429:
            return None, elapsed, "Rate limited - wait and retry"
        else:
            return None, elapsed, f"Error {response.status_code}"
    except Exception as e:
        return None, 0, str(e)


def rate_output(style, output):
    """Simple quality check for each style"""
    if not output:
        return 0, "No output"
    
    issues = []
    score = 10
    
    if style == "json":
        try:
            json.loads(output)
        except:
            score -= 5
            issues.append("Invalid JSON")
        if "task" not in output.lower():
            score -= 2
            issues.append("Missing task field")
    
    elif style == "toon":
        # TOON should NOT have braces or quotes
        lines = output.strip().split('\n')
        if '{' in output and '"' in output:
            score -= 4
            issues.append("Contains JSON-like syntax (should be TOON)")
        if ':' not in output:
            score -= 3
            issues.append("Missing TOON key:value format")
        # Check for tabular array syntax
        if '[' in output and '{' in output.split('\n')[0]:
            score += 1  # Bonus for proper array declaration
    
    elif style == "markdown":
        if "## " not in output and "# " not in output:
            score -= 3
            issues.append("Missing markdown headers")
        if "Task" not in output:
            score -= 2
            issues.append("Missing Task section")
    
    elif style == "persona":
        if "You are" not in output:
            score -= 4
            issues.append("Missing persona intro")
    
    elif style == "cot":
        if "Consider" not in output and "Then" not in output:
            score -= 2
            issues.append("Missing CoT structure")
    
    elif style == "fewshot":
        if "Example" not in output and "pattern" not in output.lower():
            score -= 2
            issues.append("Missing example pattern")
    
    elif style == "professional":
        if len(output) < 20:
            score -= 2
            issues.append("Too short")
    
    return max(0, score), ", ".join(issues) if issues else "Good"


def main():
    test_prompts = [
        "help me write a python script that sorts a list of numbers",
        "explain machine learning to a beginner",
        "i need to create a todo app with tasks and due dates"
    ]
    
    styles = ["professional", "markdown", "json", "toon", "persona", "cot", "fewshot"]
    
    results = []
    
    print("="*60)
    print("PROMPTSTYLER EXTENSION PERFORMANCE TEST")
    print("Using: Shared System Prompt (Single Source of Truth)")
    print("="*60)
    print(f"Model: {GROQ_MODEL}")
    print()
    
    if not GROQ_API_KEY:
        print("ERROR: No API key found!")
        print("Set GROQ_API_KEY environment variable:")
        print("  Windows: set GROQ_API_KEY=your_key")
        print("  Linux/Mac: export GROQ_API_KEY=your_key")
        return
    
    for style in styles:
        print(f"\n--- Testing {style.upper()} ---")
        style_scores = []
        
        for prompt in test_prompts:
            output, elapsed, error = test_style(prompt, style)
            
            if error:
                print(f"  ERROR: {error}")
                style_scores.append(0)
            else:
                score, notes = rate_output(style, output)
                style_scores.append(score)
                print(f"  Score: {score}/10 | Time: {elapsed:.1f}s | {notes}")
                print(f"  Output: {output[:100]}...")
            
            time.sleep(0.1)  # Minimal rate limit for Groq
        
        avg = sum(style_scores) / len(style_scores) if style_scores else 0
        results.append((style, avg))
        print(f"  AVG: {avg:.1f}/10")
    
    # Summary
    print("\n" + "="*60)
    print("PERFORMANCE SUMMARY")
    print("="*60)
    
    results.sort(key=lambda x: -x[1])
    
    for style, avg in results:
        bar = "█" * int(avg) + "░" * (10 - int(avg))
        status = "✅" if avg >= 7 else "⚠️" if avg >= 5 else "❌"
        print(f"{status} {style:12} {bar} {avg:.1f}/10")
    
    overall = sum(r[1] for r in results) / len(results)
    print(f"\nOVERALL: {overall:.1f}/10")
    
    # Save report
    os.makedirs("output", exist_ok=True)
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "model": GROQ_MODEL,
        "prompt_source": "shared/system_prompt.py",
        "results": {style: score for style, score in results},
        "overall": overall,
        "test_prompts": test_prompts
    }
    
    with open("output/extension_performance.json", "w") as f:
        json.dump(report, f, indent=2)
    
    print("\nSaved to output/extension_performance.json")


if __name__ == "__main__":
    main()
