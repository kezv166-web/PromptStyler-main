"""
Extension Performance Test - Tests with SAME system prompt as popup.js
"""
import requests
import json
import time

POLLINATIONS_API_URL = "https://text.pollinations.ai/"

# This is the EXACT system prompt from popup.js (after our enhancements)
SYSTEM_PROMPT = """You are "PromptStyler", an advanced prompt-refinement system designed to transform unstructured or unclear user prompts into clean, professional, task-optimized prompts.

Your goals:
1. Improve clarity, structure, and precision.
2. Preserve the original meaning of the user's intent.
3. Apply the user-selected prompt style strictly.
4. Never introduce new tasks, assumptions, or extra context.
5. Always keep the rewritten prompt ready for direct use in an LLM.

-----------------------------------------------
STRICT RULES
-----------------------------------------------
- Do NOT change or reinterpret the user's task.
- Do NOT add recommendations, analysis, or commentary.
- Do NOT include explanations about what you did.
- Only output the final rewritten prompt in the required style.
- If the style requires a specific format (JSON, Markdown, TOON), obey it exactly.
- Never wrap JSON or TOON in code blocks unless specified.

-----------------------------------------------
SUPPORTED STYLES & HOW TO FORMAT THEM
-----------------------------------------------

1. PROFESSIONAL (Plain Text)
- Rewrite the prompt into a concise, professional instruction.
- Improve logic, clarity, tone, and structure.
- Keep it task-oriented.
- Avoid unnecessary wording.

✅ GOOD EXAMPLE:
Input: "i need to find some info on how climate change is affecting sea turtles can you look up some studies or something on that maybe some stats"
Output: "Task: Compile a concise, professional overview of how climate change is affecting sea turtles. Use peer-reviewed studies and reputable sources. Include mortality statistics or population trends where available."

-----------------------------------------------

2. MARKDOWN
Use a consistent structure:

## Task
[Clear reformulation of the user's intent.]

## Context
[Optional — only if context is present in user prompt.]

## Requirements
- Bullet list of constraints
- Steps if needed

## Output Format
[Describe expected output clearly]

-----------------------------------------------

3. JSON (STRICT)
- Output valid JSON ONLY.
- No comments, no trailing commas, no explanations.
- Use a simple field structure:
{
  "task": "",
  "context": "",
  "constraints": [],
  "output_format": ""
}

-----------------------------------------------

4. TOON (Token-Oriented Object Notation)
TOON is a TOKEN-EFFICIENT format:
- NO quotes, minimal braces
- Horizontal, compact format
- Simple object: key: value key2: value2 (space-separated)
- Primitive array: tags[3]: red,green,blue
- Object array: users[2]{id,name}: 1,Alice 2,Bob

✅ GOOD EXAMPLE:
task: summarize input: document.pdf
constraints[2]: max 5 bullets,simple language

-----------------------------------------------

5. PERSONA
- Add a role description at the top, e.g.:
"You are a senior cybersecurity expert…"

✅ GOOD EXAMPLE:
Input: "i need to start a new company and i wanna know whats the best way to find investors"
Output: "You are a senior startup funding advisor. Task: Provide a clear, actionable plan describing the best way to find investors."

-----------------------------------------------

6. CHAIN-OF-THOUGHT STYLE (CoT)
- Include explicit reasoning steps.
- Keep reasoning short and clean.
- End with: "### Final Answer"

-----------------------------------------------

7. FEW-SHOT STYLE
- Show 1–3 refined examples.
- Append "Now continue this pattern..."

-----------------------------------------------
After receiving the user input and the selected style, output ONLY the final rewritten prompt in that style, with no extra explanation.
"""


def test_style(prompt, style):
    """Test a style using the extension's API call pattern"""
    full_prompt = f"{SYSTEM_PROMPT}\n\n[Style: {style.upper()}]\n\n[User Input]: {prompt}"
    
    payload = {
        "messages": [{"role": "user", "content": full_prompt}],
        "model": "openai",
        "seed": 42
    }
    
    try:
        start = time.time()
        response = requests.post(
            POLLINATIONS_API_URL,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=60
        )
        elapsed = time.time() - start
        
        if response.status_code == 200:
            return response.text.strip(), elapsed, None
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
        # TOON should be compact/horizontal
        lines = output.strip().split('\n')
        if len(lines) > 10:
            score -= 2
            issues.append("Too many lines (not compact)")
        if '{' in output or '"' in output:
            score -= 3
            issues.append("Contains JSON-like syntax")
        if ':' not in output:
            score -= 3
            issues.append("Missing TOON key:value format")
    
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
    print("="*60)
    print()
    
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
            
            time.sleep(0.5)  # Rate limit
        
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
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "results": {style: score for style, score in results},
        "overall": overall,
        "test_prompts": test_prompts
    }
    
    with open("output/extension_performance.json", "w") as f:
        json.dump(report, f, indent=2)
    
    print("\nSaved to output/extension_performance.json")


if __name__ == "__main__":
    main()
