// PromptStyler Options Page - API Key Management + Learning Stats

document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('api-key');
    const toggleBtn = document.getElementById('toggle-visibility');
    const saveBtn = document.getElementById('save-btn');
    const statusMessage = document.getElementById('status-message');

    // Load existing API key on page load (sync first, local fallback)
    const syncResult = await chrome.storage.sync.get(['groqApiKey']);
    if (syncResult.groqApiKey) {
        apiKeyInput.value = syncResult.groqApiKey;
        showStatus('API key loaded from synced storage.', 'success');
    } else {
        // Fallback: migrate from local to sync
        const localResult = await chrome.storage.local.get(['groqApiKey']);
        if (localResult.groqApiKey) {
            apiKeyInput.value = localResult.groqApiKey;
            // Migrate to sync
            await chrome.storage.sync.set({ groqApiKey: localResult.groqApiKey });
            showStatus('API key migrated to synced storage.', 'success');
        }
    }

    // Load learning stats
    loadLearningStats();

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
                // Save to both sync (primary) and local (fallback)
                await chrome.storage.sync.set({ groqApiKey: apiKey });
                await chrome.storage.local.set({ groqApiKey: apiKey });
                showStatus('✅ API key saved and verified! Synced across your devices.', 'success');
            } else {
                showStatus(`❌ ${testResult.error}`, 'error');
            }
        } catch (error) {
            // If test fails, still try to save (might be network issue)
            await chrome.storage.sync.set({ groqApiKey: apiKey });
            await chrome.storage.local.set({ groqApiKey: apiKey });
            showStatus('⚠️ API key saved. Could not verify - please test by refining a prompt.', 'success');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Save API Key';
        }
    });

    // Clear feedback data button
    const clearBtn = document.getElementById('clear-feedback-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all feedback data? This cannot be undone.')) {
                try {
                    // Load db.js dynamically for options page
                    if (typeof PromptStylerDB !== 'undefined') {
                        await PromptStylerDB.init();
                        await PromptStylerDB.clearAll();
                        showStatus('✅ All feedback data cleared.', 'success');
                        loadLearningStats();
                    }
                } catch (e) {
                    showStatus('❌ Failed to clear data: ' + e.message, 'error');
                }
            }
        });
    }

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

    // Load and display learning stats
    async function loadLearningStats() {
        const statsContainer = document.getElementById('learning-stats');
        if (!statsContainer) return;

        try {
            if (typeof PromptStylerDB === 'undefined') {
                statsContainer.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">Database module not loaded.</p>';
                return;
            }

            await PromptStylerDB.init();
            const stats = await PromptStylerDB.getStats();

            if (stats.total === 0) {
                statsContainer.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">No feedback data yet. Start refining prompts to build your learning history!</p>';
                return;
            }

            let html = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number">${stats.total}</div>
                        <div class="stat-label">Total Refinements</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.positive}</div>
                        <div class="stat-label">👍 Positive</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.edited}</div>
                        <div class="stat-label">✏️ Edited (Gold)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.negative}</div>
                        <div class="stat-label">👎 Negative</div>
                    </div>
                </div>
            `;

            // Style breakdown
            const styles = Object.entries(stats.byStyle);
            if (styles.length > 0) {
                html += '<div class="style-breakdown"><div class="section-label" style="margin-top: 16px; margin-bottom: 8px;">By Style</div>';
                styles.forEach(([style, count]) => {
                    const pct = Math.round((count / stats.total) * 100);
                    html += `
                        <div class="style-bar-row">
                            <span class="style-bar-label">${style}</span>
                            <div class="style-bar-track">
                                <div class="style-bar-fill" style="width: ${pct}%"></div>
                            </div>
                            <span class="style-bar-count">${count}</span>
                        </div>
                    `;
                });
                html += '</div>';
            }

            statsContainer.innerHTML = html;
        } catch (e) {
            console.warn('Failed to load learning stats', e);
            statsContainer.innerHTML = '<p style="color: var(--text-secondary); font-size: 14px;">Could not load stats.</p>';
        }
    }
});
