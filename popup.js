/**
 * PromptStyler Popup Script
 * 
 * System prompt is loaded from shared/system_prompt.js (single source of truth)
 * The PROMPTSTYLER_SYSTEM_PROMPT global is available via the script tag in popup.html
 */

// Use the shared system prompt (loaded from shared/system_prompt.js)
const SYSTEM_PROMPT = window.PROMPTSTYLER_SYSTEM_PROMPT || 'You are PromptStyler, a prompt refinement assistant.';

// Groq API Configuration
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

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
            // Get API key from storage
            const storage = await chrome.storage.local.get(['groqApiKey']);
            const apiKey = storage.groqApiKey;

            if (!apiKey) {
                showToast('Please add your Groq API key in Settings first!', 'error');
                refinedPrompt.value = '⚠️ No API key found.\n\nTo get started:\n1. Click the ⚙️ Settings button above\n2. Get your FREE API key from Groq\n3. Paste it in the settings and save\n\nGroq offers 14,400 free requests per day!';
                return;
            }

            // Call Groq API
            const response = await callGroq(userText, style, apiKey);

            refinedPrompt.value = response;
            outputContainer.classList.remove('hidden');
        } catch (error) {
            console.error('Error:', error);
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                showToast('Invalid API key. Please check your Groq API key in Settings.', 'error');
            } else if (error.message.includes('429')) {
                showToast('Rate limit exceeded. Please wait a moment and try again.', 'error');
            } else {
                showToast('Failed to refine: ' + error.message, 'error');
            }
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

    // Groq API Call
    async function callGroq(text, style, apiKey) {
        // Construct the user prompt (style + input)
        const userPrompt = `Style: ${style}\n\nUser Input:\n${text}`;

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        try {
            const res = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 2048
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(`Groq API Error: ${res.status} ${errorData.error?.message || res.statusText}`);
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
