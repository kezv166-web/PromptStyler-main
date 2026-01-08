// System Prompt - Enhanced with few-shot examples from training data
const SYSTEM_PROMPT = `You are "PromptStyler", an advanced prompt-refinement system designed to transform unstructured or unclear user prompts into clean, professional, task-optimized prompts.

Your goals:
1. Improve clarity, structure, and precision.
2. Preserve the original meaning of the user’s intent.
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

Do not add sections the user did not imply.

✅ GOOD EXAMPLE:
Input: "i wanna know how kids from low income family can get into good colleges"
Output:
## Task
Explain the college admission pathway for low-income students.

## Context
Audience: prospective college applicants from low-income backgrounds.

## Requirements
- Cover tests, recommendations, financial aid
- Use plain language suitable for a broad audience

## Output Format
Markdown with sections and bullet points for readability

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

- All fields must be present, even if left empty.

✅ GOOD EXAMPLE:
Input: "i need help with studyin for my exam on american history"
Output: {
  "task": "Explain and compare the American Revolutionary War and the American Civil War.",
  "context": "Student studying for an American history exam.",
  "constraints": "Present information by war and topic (causes, major events, impact); use concise bullet points.",
  "output_format": "sections: Overview, Causes, Major_events, Impact, Resources"
}

-----------------------------------------------

4. TOON (Token-Oriented Object Notation)
Use TOON strictly. Format rules:

1. Basic Objects: Remove curly braces, use indentation.
   key: value

2. Nested Objects: Use indentation to show nesting.
   parent:
     child: value

3. Primitive Arrays: Declare name[length]: values (comma-sep)
   tags[3]: foo,bar,baz

4. Uniform Object Arrays (Tabular): Declare name[length]{keys}:
   users[2]{id,name}:
     1,Alice
     2,Bob

5. Delimiter: Values separated by commas. Strings quoted only if needed.

If the user input is unstructured text, extract the key entities and represent them in this format. Default to a main object wrapper if needed.

✅ GOOD EXAMPLE:
Input: "write a function that finds the first pair of numbers that add up to a target"
Output:
task:
  action: implement function to find pair of numbers summing to target
  signature: first_pair_indices(nums, target) -> (i, j) or None
  input:
    nums: list of numbers
    target: number
  output: (i, j) or None
  behavior:
    - scan left-to-right to identify valid pair
    - return None if no pair exists

⚠️ AVOID: TOON is NOT good for creative/narrative prompts. Use for structured tasks only.

-----------------------------------------------

5. PERSONA
- Add a role description at the top, e.g.:
“You are a senior cybersecurity expert…”

- Rewrite the prompt so that:
  - The persona is active
  - The instructions remain unchanged
- Keep output professional and concise.

✅ GOOD EXAMPLE:
Input: "i need to start a new company and i wanna know whats the best way to find investors"
Output: "You are a senior startup funding advisor. You provide practical, results-oriented guidance to founders seeking capital. Task: Provide a clear, actionable plan describing the best way to find investors who will fund a new business to fuel its growth."

-----------------------------------------------

6. CHAIN-OF-THOUGHT STYLE (CoT)
- Include explicit reasoning steps.
- Keep reasoning short and clean.
- End with: “### Final Answer:” followed by the completed task.

✅ GOOD EXAMPLE:
Input: "whats the best way to stay motivated when working on a long project"
Output:
Task: Develop a practical motivation plan for staying engaged with a long, challenging project.

Consider: clarity of next action; breaking work into small chunks; timeboxing strategies; energy management; accountability; celebrating small wins.

Then: Provide a step-by-step plan including daily micro-goals, focus blocks, weekly reviews, and progress tracking.

Given these, produce a personalized, concrete motivation plan.
### Final Answer

-----------------------------------------------

7. FEW-SHOT STYLE
- Convert user examples into a clear pattern.
- Show 1–3 refined examples.
- Append “Now continue this pattern for the user’s query.”

✅ GOOD EXAMPLE:
Input: "how to calculate break even point for my startup"
Output:
Task: Calculate the break-even point for a subscription-based startup.

Example 1
Fixed costs: $65,000/month
Variable cost per subscriber: $8
Price per subscriber: $20
Steps:
1) Contribution margin = 20 - 8 = 12
2) BEP_subscribers = 65,000 / 12 ≈ 5,417
Output: BEP_subscribers: 5,417

Now continue this pattern...

-----------------------------------------------
TOKEN AWARENESS RULE
-----------------------------------------------
Always keep unnecessary text to a minimum.  
For JSON and TOON, reduce symbols, repetition, and verbosity.  
For persona and Markdown prompts, keep structure clean and lean.

-----------------------------------------------
FINAL OUTPUT INSTRUCTION
-----------------------------------------------
After receiving the user input and the selected style, output ONLY the final rewritten prompt in that style, with no extra explanation.
`;

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const originalPrompt = document.getElementById('original-prompt');
    const styleSelect = document.getElementById('style-select');
    const refineBtn = document.getElementById('refine-btn');
    const refinedPrompt = document.getElementById('refined-prompt');
    const outputContainer = document.getElementById('output-container');
    const copyBtn = document.getElementById('copy-btn');
    const toast = document.getElementById('toast');
    const settingsBtn = document.getElementById('settings-btn');
    const btnText = refineBtn.querySelector('.btn-text');
    const btnLoader = refineBtn.querySelector('.btn-loader');

    // Rate limiting - prevent API abuse
    const RATE_LIMIT_MS = 3000; // 3 seconds between requests
    const MAX_INPUT_LENGTH = 10000; // Maximum 10,000 characters
    const API_TIMEOUT_MS = 30000; // 30 second timeout
    let lastRequestTime = 0;

    // Check for pending text from context menu or content script
    chrome.storage.local.get(['pendingText', 'source'], (result) => {
        if (result.pendingText) {
            originalPrompt.value = result.pendingText;
            // Clear the pending text
            chrome.storage.local.remove(['pendingText', 'source']);

            // Auto-focus the textarea
            originalPrompt.focus();

            // Show a hint that text was loaded
            showToast('Text loaded! Click Refine or press Ctrl+Enter', 'success');
        }
    });

    // Navigation
    settingsBtn.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });

    // Keyboard shortcut - Ctrl+Enter to submit
    originalPrompt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            refineBtn.click();
        }
    });

    // Main Action
    refineBtn.addEventListener('click', async () => {
        const userText = originalPrompt.value.trim();
        const style = styleSelect.value;

        // Input validation - empty check
        if (!userText) {
            showToast('Please enter a prompt to refine.', 'error');
            return;
        }

        // Input validation - length check
        if (userText.length > MAX_INPUT_LENGTH) {
            showToast(`Prompt too long. Maximum ${MAX_INPUT_LENGTH} characters allowed.`, 'error');
            return;
        }

        // Rate limiting - prevent spam
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < RATE_LIMIT_MS) {
            const waitTime = Math.ceil((RATE_LIMIT_MS - timeSinceLastRequest) / 1000);
            showToast(`Please wait ${waitTime}s before refining again.`, 'error');
            return;
        }
        lastRequestTime = now;

        // Loading State
        setLoading(true);
        outputContainer.classList.remove('hidden');
        refinedPrompt.value = 'Refining...';

        try {
            // Directly call Pollinations AI (No API Key needed)
            const response = await callPollinations(userText, style);

            refinedPrompt.value = response;
            outputContainer.classList.remove('hidden');
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to refine: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    });

    // Copy Action
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(refinedPrompt.value);
            showToast();
        } catch (err) {
            // Fallback for older browsers
            refinedPrompt.select();
            document.execCommand('copy');
            showToast();
        }
    });

    // Helpers
    function setLoading(isLoading) {
        refineBtn.disabled = isLoading;
        if (isLoading) {
            btnText.classList.add('hidden');
            btnLoader.classList.remove('hidden');
        } else {
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
        }
    }

    function showToast(message = 'Copied to clipboard!', type = 'success') {
        toast.textContent = message;
        toast.style.backgroundColor = type === 'error' ? 'var(--danger-color)' : 'var(--success-color)';
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 2500);
    }

    // Settings no longer needed for API key, but kept for future extensibility if needed
    // or we can remove if we want to fully clean up. 
    // For now, removing the check for API key.

    async function callPollinations(text, style) {
        // Construct the user prompt (style + input)
        const userPrompt = `Style: ${style}\n\nUser Input:\n${text}`;

        // Use the new gen.pollinations.ai endpoint (not deprecated)
        const url = 'https://gen.pollinations.ai/v1/chat/completions';

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'openai',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt }
                    ],
                    seed: 42
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`Pollinations API Error: ${res.status} ${res.statusText}`);
            }

            const data = await res.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timed out. Please try again.');
            }
            throw error;
        }
    }
});
