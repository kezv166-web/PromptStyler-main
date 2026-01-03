"""
Extract best DO and DONT examples from training data for few-shot prompting.
"""
import json

def extract_examples():
    with open('output/training_data.jsonl', 'r', encoding='utf-8') as f:
        data = [json.loads(line) for line in f if line.strip()]
    
    styles = ['professional', 'markdown', 'json', 'toon', 'persona', 'cot', 'fewshot']
    
    examples = {}
    
    for style in styles:
        style_data = [d for d in data if d.get('style') == style]
        
        # Best DO (highest score)
        do_samples = [d for d in style_data if d.get('label') == 'DO']
        do_samples.sort(key=lambda x: x.get('score', 0), reverse=True)
        
        # Best DONT (lowest score)
        dont_samples = [d for d in style_data if d.get('label') == 'DONT']
        dont_samples.sort(key=lambda x: x.get('score', 0))
        
        # Take top 2 of each
        examples[style] = {
            'do_examples': do_samples[:2] if do_samples else [],
            'dont_examples': dont_samples[:2] if dont_samples else [],
            'stats': {
                'do_count': len(do_samples),
                'dont_count': len(dont_samples)
            }
        }
        
        print(f"=== {style.upper()} ===")
        print(f"DO: {len(do_samples)}, DONT: {len(dont_samples)}")
        if do_samples:
            print(f"Best DO (score {do_samples[0].get('score')}):")
            print(f"  Input: {do_samples[0].get('input', '')[:80]}...")
        if dont_samples:
            print(f"Worst DONT (score {dont_samples[0].get('score')}):")
            print(f"  Input: {dont_samples[0].get('input', '')[:80]}...")
        print()
    
    # Save extracted examples
    with open('output/fewshot_examples.json', 'w', encoding='utf-8') as f:
        json.dump(examples, f, indent=2, ensure_ascii=False)
    
    print("Saved to output/fewshot_examples.json")
    return examples

if __name__ == "__main__":
    extract_examples()
