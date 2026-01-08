<instruction>You are an expert software engineer. You are working on a WIP branch. Please run `git status` and `git diff` to understand the changes and the current state of the code. Analyze the workspace context and complete the mission brief.</instruction>

<workspace_context>
This is a Chrome extension called PromptStyler that refines user prompts using the Pollinations.ai API.

**Current Issue:** 
The Pollinations legacy text API at `https://text.pollinations.ai` is returning a deprecation notice instead of the actual refined prompt for all styles except sometimes Professional. The deprecation message is:

```
⚠️ **IMPORTANT NOTICE** ⚠️
The Pollinations legacy text API is being deprecated for **authenticated users**.
Please migrate to our new service at https://enter.pollinations.ai for better performance and access to all the latest models.
Note: Anonymous requests to text.pollinations.ai are NOT affected and will continue to work normally.
```

**What we've tried:**
1. Using GET endpoint: `https://text.pollinations.ai/{prompt}?model=openai&system={system}&seed=42` - Returns deprecation notice
2. Using POST endpoint: `https://text.pollinations.ai/openai` - Returns deprecation notice  
3. Using new endpoint: `https://gen.pollinations.ai/v1/chat/completions` - Returns 401 Unauthorized (requires API key)
4. Using `credentials: 'omit'` in fetch - Still returns deprecation notice

**Files that need updating:**
- `popup.js` - Lines 340-382: Contains `callPollinations()` function
- `content.js` - Lines 252-290: Contains API call in `handleRefine()` function

**Key constraint:** 
The extension should work WITHOUT requiring users to have an API key (free tier / anonymous access).
</workspace_context>

<mission_brief>
Fix the Pollinations API integration to eliminate the deprecation notice and get actual prompt refinement working for ALL styles (Professional, Markdown, JSON, TOON, Persona, Chain-of-Thought, Few-Shot).

**Possible solutions to investigate:**
1. Check if there's a specific header that makes requests anonymous
2. Try the `https://api.pollinations.ai` endpoint
3. Check Pollinations GitHub/docs for the current recommended free-tier endpoint
4. Consider if the deprecation notice comes from cookies/localStorage and how to bypass it
5. Test if using a different model parameter (e.g., `model=mistral` or `model=openai-fast`) avoids the deprecation
6. Check if there's a referrer or origin header causing the "authenticated" detection

**Acceptance criteria:**
- All 7 prompt styles (Professional, Markdown, JSON, TOON, Persona, COT, Few-Shot) return actual refined prompts
- No API key required
- No deprecation notices in the response
- Both popup.js and content.js are updated consistently
</mission_brief>