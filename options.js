// PromptStyler Options Page - API Key Management

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const toggleBtn = document.getElementById('toggle-visibility');
    const saveBtn = document.getElementById('save-btn');
    const statusMessage = document.getElementById('status-message');

    // Load existing API key on page load
    chrome.storage.local.get(['groqApiKey'], (result) => {
        if (result.groqApiKey) {
            apiKeyInput.value = result.groqApiKey;
            showStatus('API key loaded from storage.', 'success');
        }
    });

    // Toggle password visibility
    toggleBtn.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleBtn.textContent = '🙈';
            toggleBtn.title = 'Hide API key';
        } else {
            apiKeyInput.type = 'password';
            toggleBtn.textContent = '👁️';
            toggleBtn.title = 'Show API key';
        }
    });

    // Save API key
    saveBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            showStatus('Please enter an API key.', 'error');
            return;
        }

        // Basic validation - Groq keys start with gsk_
        if (!apiKey.startsWith('gsk_')) {
            showStatus('Invalid key format. Groq API keys start with "gsk_"', 'error');
            return;
        }

        // Disable button while saving
        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ Saving...';

        try {
            // Optional: Test the API key with a simple request
            const testResult = await testApiKey(apiKey);

            if (testResult.success) {
                // Save to chrome storage
                await chrome.storage.local.set({ groqApiKey: apiKey });
                showStatus('✅ API key saved and verified! You can now use PromptStyler.', 'success');
            } else {
                showStatus(`❌ ${testResult.error}`, 'error');
            }
        } catch (error) {
            // If test fails, still try to save (might be network issue)
            await chrome.storage.local.set({ groqApiKey: apiKey });
            showStatus('⚠️ API key saved. Could not verify - please test by refining a prompt.', 'success');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Save API Key';
        }
    });

    // Test API key with a minimal request
    async function testApiKey(apiKey) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 5
                })
            });

            if (response.ok) {
                return { success: true };
            } else if (response.status === 401) {
                return { success: false, error: 'Invalid API key. Please check and try again.' };
            } else if (response.status === 429) {
                // Rate limited but key is valid
                return { success: true };
            } else {
                const data = await response.json().catch(() => ({}));
                return { success: false, error: data.error?.message || `API Error: ${response.status}` };
            }
        } catch (error) {
            throw error; // Network error, let caller handle
        }
    }

    // Show status message
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message ' + type;
    }
});
