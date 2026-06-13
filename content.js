// Content Script for PromptStyler
// Injects popup panel directly into AI chat sites
// Includes feedback tracking via IndexedDB (shared/db.js)

(function () {
    'use strict';

    /**
     * System prompt is loaded from shared/system_prompt.js via manifest.json
     * Database is loaded from shared/db.js via manifest.json
     * Smart prompt is loaded from shared/smart_prompt.js via manifest.json
     */
    const SYSTEM_PROMPT = window.PROMPTSTYLER_SYSTEM_PROMPT ||
        'You are PromptStyler, a prompt refinement assistant. Refine the user\'s prompt according to the selected style.';

    // Groq API Configuration
    const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
    const GROQ_MODEL = 'llama-3.3-70b-versatile';

    // Site configurations
    const SITE_CONFIGS = {
        'chat.openai.com': { inputSelector: '#prompt-textarea', containerSelector: 'form' },
        'chatgpt.com': { inputSelector: '#prompt-textarea', containerSelector: 'form' },
        'claude.ai': { inputSelector: '[contenteditable="true"]', containerSelector: 'form' },
        'gemini.google.com': { inputSelector: 'rich-textarea textarea, textarea', containerSelector: 'form' }
    };

    const currentHost = window.location.hostname;
    const config = SITE_CONFIGS[currentHost];
    if (!config) return;

    let isRefining = false;
    let originalText = '';
    let lastRefineTime = 0;
    const RATE_LIMIT_MS = 3000;
    const MAX_INPUT_LENGTH = 10000;

    // Feedback tracking
    let currentRecordId = null;
    let originalOutput = '';
    let isEditingResult = false;

    // Initialize DB
    if (typeof PromptStylerDB !== 'undefined') {
        PromptStylerDB.init().catch(e => console.warn('PromptStylerDB: init failed in content', e));
    }

    // Inject styles
    function injectStyles() {
        if (document.getElementById('promptstyler-styles')) return;
        const style = document.createElement('style');
        style.id = 'promptstyler-styles';
        style.textContent = `
            #ps-popup-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.6);
                z-index: 999998;
                animation: psFadeIn 0.2s ease;
            }
            #ps-popup {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 500px;
                max-height: 85vh;
                background: #181b21;
                border-radius: 16px;
                box-shadow: 0 25px 80px rgba(0,0,0,0.5);
                z-index: 999999;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #f3f4f6;
                animation: psSlideIn 0.3s ease;
                overflow: visible;
            }
            #ps-popup * { box-sizing: border-box; margin: 0; padding: 0; }
            .ps-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid #2f3441;
                background: #1e2128;
            }
            .ps-logo { 
                display: flex; 
                align-items: center; 
                gap: 10px; 
                font-weight: 600; 
                font-size: 18px;
            }
            .ps-close {
                background: none; border: none; color: #9ca3af;
                font-size: 24px; cursor: pointer; padding: 4px 8px;
                border-radius: 6px; transition: all 0.2s;
            }
            .ps-close:hover { color: #fff; background: rgba(255,255,255,0.1); }
            .ps-header-actions { display: flex; align-items: center; gap: 8px; }
            .ps-settings {
                background: #22262e; border: 1px solid #2f3441; color: #f3f4f6;
                font-size: 16px; cursor: pointer; padding: 4px 8px;
                border-radius: 6px; transition: all 0.2s;
            }
            .ps-settings:hover { background: #6366f1; border-color: #6366f1; color: #fff; }
            .ps-body { padding: 24px; display: flex; flex-direction: column; gap: 24px; max-height: calc(85vh - 70px); overflow-y: auto; overflow-x: hidden; }
            .ps-label {
                font-size: 12px; font-weight: 600; color: #9ca3af;
                text-transform: uppercase; letter-spacing: 0.08em;
                margin-bottom: 8px;
            }
            .ps-textarea {
                width: 100%; background: #22262e; border: 1px solid #2f3441;
                border-radius: 10px; padding: 14px 16px; color: #f3f4f6;
                font-family: inherit; font-size: 15px; resize: vertical;
                min-height: 100px; line-height: 1.5;
                transition: border-color 0.2s;
            }
            .ps-textarea:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.2); }
            .ps-textarea.ps-editing { border-color: #6366f1; background: #1a1e26; }
            .ps-select {
                width: 100%; background: #22262e; border: 1px solid #2f3441;
                border-radius: 10px; padding: 14px 16px; color: #f3f4f6;
                font-family: inherit; font-size: 15px; cursor: pointer;
            }
            .ps-select:focus { outline: none; border-color: #6366f1; }
            .ps-btn-primary {
                width: 100%; background: linear-gradient(135deg, #6366f1, #8b5cf6);
                border: none; border-radius: 10px; padding: 16px;
                color: white; font-weight: 600; font-size: 16px;
                cursor: pointer; transition: all 0.2s;
            }
            .ps-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99,102,241,0.4); }
            .ps-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
            .ps-result-section { display: none; margin-top: 4px; }
            .ps-result-section.visible { display: block; }
            .ps-result-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
            .ps-result-actions { display: flex; gap: 8px; }
            .ps-btn-copy, .ps-btn-edit {
                background: #22262e; border: 1px solid #2f3441;
                border-radius: 6px; padding: 8px 14px; color: #9ca3af;
                font-size: 13px; cursor: pointer; transition: all 0.2s;
            }
            .ps-btn-copy:hover, .ps-btn-edit:hover { color: #fff; border-color: #6366f1; background: #2a2f38; }
            .ps-btn-edit.active { color: #6366f1; border-color: #6366f1; }
            .ps-feedback-row {
                display: flex; align-items: center; justify-content: space-between;
                padding: 8px 0; margin-top: 4px;
            }
            .ps-feedback-label { font-size: 12px; color: #9ca3af; }
            .ps-feedback-buttons { display: flex; gap: 8px; }
            .ps-feedback-btn {
                background: #22262e; border: 1px solid #2f3441;
                border-radius: 6px; padding: 6px 12px; font-size: 16px;
                cursor: pointer; transition: all 0.2s; opacity: 0.6;
            }
            .ps-feedback-btn:hover { opacity: 1; transform: scale(1.1); }
            .ps-feedback-btn.active { opacity: 1; border-color: #6366f1; background: rgba(99,102,241,0.15); }
            .ps-actions { display: flex; gap: 12px; margin-top: 12px; }
            .ps-btn-use {
                flex: 1; background: #10b981; border: none; border-radius: 10px;
                padding: 14px; color: white; font-weight: 600; font-size: 15px; 
                cursor: pointer; transition: all 0.2s;
            }
            .ps-btn-use:hover { background: #059669; }
            .ps-footer { margin-top: 16px; padding: 10px; text-align: center; font-size: 12px; color: #9ca3af; background: rgba(255,193,7,0.1); border-radius: 6px; border: 1px solid rgba(255,193,7,0.2); }
            .ps-error { color: #ef4444; font-size: 12px; padding: 8px; background: rgba(239,68,68,0.1); border-radius: 4px; }
            @keyframes psFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes psSlideIn { from { opacity: 0; transform: translate(-50%, -45%); } to { opacity: 1; transform: translate(-50%, -50%); } }
        `;
        document.head.appendChild(style);
    }

    // Create popup HTML
    function createPopup(text) {
        originalText = text;
        currentRecordId = null;
        originalOutput = '';
        isEditingResult = false;

        const overlay = document.createElement('div');
        overlay.id = 'ps-popup-overlay';
        overlay.onclick = closePopup;

        const popup = document.createElement('div');
        popup.id = 'ps-popup';
        popup.onclick = (e) => e.stopPropagation();
        popup.innerHTML = `
            <div class="ps-header">
                <div class="ps-logo">✨ PromptStyler</div>
                <div class="ps-header-actions">
                    <button class="ps-settings" id="ps-settings" title="Settings - Add API Key">⚙️</button>
                    <button class="ps-close" id="ps-close">&times;</button>
                </div>
            </div>
            <div class="ps-body">
                <div>
                    <div class="ps-label">Your Prompt</div>
                    <textarea class="ps-textarea" id="ps-input" rows="4">${escapeHtml(text)}</textarea>
                </div>
                <div>
                    <div class="ps-label">Style</div>
                    <select class="ps-select" id="ps-style">
                        <option value="PROFESSIONAL">Professional</option>
                        <option value="MARKDOWN">Markdown</option>
                        <option value="JSON">JSON</option>
                        <option value="TOON">TOON</option>
                        <option value="PERSONA">Persona</option>
                        <option value="COT">Chain of Thought</option>
                        <option value="FEW_SHOT">Few-Shot</option>
                    </select>
                </div>
                <button class="ps-btn-primary" id="ps-refine">✨ Refine Prompt</button>
                <div class="ps-result-section" id="ps-result-section">
                    <div class="ps-result-header">
                        <div class="ps-label">Refined Result</div>
                        <div class="ps-result-actions">
                            <button class="ps-btn-edit" id="ps-edit" title="Edit this result">✏️ Edit</button>
                            <button class="ps-btn-copy" id="ps-copy">📋 Copy</button>
                        </div>
                    </div>
                    <textarea class="ps-textarea" id="ps-result" rows="5" readonly></textarea>
                    <div class="ps-feedback-row">
                        <span class="ps-feedback-label">How was this?</span>
                        <div class="ps-feedback-buttons">
                            <button class="ps-feedback-btn" id="ps-fb-up" title="Good result">👍</button>
                            <button class="ps-feedback-btn" id="ps-fb-down" title="Bad result">👎</button>
                        </div>
                    </div>
                    <div class="ps-actions">
                        <button class="ps-btn-use" id="ps-use">✅ Use This Prompt</button>
                    </div>
                    <div class="ps-footer">⚠️ AI-generated output — please verify before using</div>
                </div>
                <div class="ps-error" id="ps-error" style="display:none;"></div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(popup);

        // Event listeners
        document.getElementById('ps-close').onclick = closePopup;
        document.getElementById('ps-settings').onclick = () => {
            chrome.runtime.sendMessage({ action: 'openOptions' });
        };
        document.getElementById('ps-refine').onclick = handleRefine;
        document.getElementById('ps-copy').onclick = handleCopy;
        document.getElementById('ps-use').onclick = handleUse;
        document.getElementById('ps-edit').onclick = handleEditToggle;
        document.getElementById('ps-fb-up').onclick = () => handleFeedback(1);
        document.getElementById('ps-fb-down').onclick = () => handleFeedback(-1);

        // Keyboard shortcuts
        popup.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closePopup();
            if (e.key === 'Enter' && e.ctrlKey) handleRefine();
        });

        document.getElementById('ps-input').focus();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function closePopup() {
        // Save edit if user was editing when closing
        if (isEditingResult && currentRecordId) {
            const resultArea = document.getElementById('ps-result');
            if (resultArea && resultArea.value !== originalOutput) {
                PromptStylerDB.updateFeedback(currentRecordId, {
                    wasEdited: true,
                    editedVersion: resultArea.value
                }).catch(console.error);
            }
        }

        const overlay = document.getElementById('ps-popup-overlay');
        const popup = document.getElementById('ps-popup');
        if (overlay) overlay.remove();
        if (popup) popup.remove();
    }

    // ─── Edit Toggle ─────────────────────────────────────
    function handleEditToggle() {
        const resultArea = document.getElementById('ps-result');
        const editBtn = document.getElementById('ps-edit');
        isEditingResult = !isEditingResult;

        resultArea.readOnly = !isEditingResult;

        if (isEditingResult) {
            resultArea.classList.add('ps-editing');
            editBtn.classList.add('active');
            editBtn.textContent = '✅ Done';
            resultArea.focus();
        } else {
            resultArea.classList.remove('ps-editing');
            editBtn.classList.remove('active');
            editBtn.textContent = '✏️ Edit';

            // Save edit to DB
            if (currentRecordId && resultArea.value !== originalOutput) {
                PromptStylerDB.updateFeedback(currentRecordId, {
                    wasEdited: true,
                    editedVersion: resultArea.value
                }).catch(console.error);
            }
        }
    }

    // ─── Feedback ────────────────────────────────────────
    function handleFeedback(rating) {
        if (!currentRecordId) return;

        const upBtn = document.getElementById('ps-fb-up');
        const downBtn = document.getElementById('ps-fb-down');

        // Toggle: clicking active button resets to 0
        const currentlyActive = rating === 1
            ? upBtn.classList.contains('active')
            : downBtn.classList.contains('active');

        const newRating = currentlyActive ? 0 : rating;

        upBtn.classList.remove('active');
        downBtn.classList.remove('active');
        if (newRating === 1) upBtn.classList.add('active');
        if (newRating === -1) downBtn.classList.add('active');

        PromptStylerDB.updateFeedback(currentRecordId, { rating: newRating })
            .catch(console.error);
    }

    async function handleRefine() {
        if (isRefining) return;

        const input = document.getElementById('ps-input');
        const style = document.getElementById('ps-style').value;
        const btn = document.getElementById('ps-refine');
        const errorDiv = document.getElementById('ps-error');
        const resultSection = document.getElementById('ps-result-section');
        const resultArea = document.getElementById('ps-result');

        const text = input.value.trim();
        if (!text) {
            showError('Please enter a prompt.');
            return;
        }

        // Input length validation
        if (text.length > MAX_INPUT_LENGTH) {
            showError(`Prompt too long. Max ${MAX_INPUT_LENGTH} characters.`);
            return;
        }

        // Rate limiting
        const now = Date.now();
        if (now - lastRefineTime < RATE_LIMIT_MS) {
            const wait = Math.ceil((RATE_LIMIT_MS - (now - lastRefineTime)) / 1000);
            showError(`Please wait ${wait}s before refining again.`);
            return;
        }
        lastRefineTime = now;

        // Reset feedback state
        currentRecordId = null;
        originalOutput = '';
        isEditingResult = false;
        resultArea.readOnly = true;
        resultArea.classList.remove('ps-editing');
        const editBtn = document.getElementById('ps-edit');
        if (editBtn) { editBtn.classList.remove('active'); editBtn.textContent = '✏️ Edit'; }
        const upBtn = document.getElementById('ps-fb-up');
        const downBtn = document.getElementById('ps-fb-down');
        if (upBtn) upBtn.classList.remove('active');
        if (downBtn) downBtn.classList.remove('active');

        try {
            isRefining = true;
            btn.disabled = true;
            btn.textContent = '⏳ Refining...';
            errorDiv.style.display = 'none';

            // Get API key from storage (sync first, local fallback)
            let apiKey = null;
            try {
                const syncStorage = await chrome.storage.sync.get(['groqApiKey']);
                apiKey = syncStorage.groqApiKey;
            } catch (e) { /* sync might not be available */ }

            if (!apiKey) {
                const storage = await chrome.storage.local.get(['groqApiKey']);
                apiKey = storage.groqApiKey;
            }

            if (!apiKey) {
                showError('No API key found. Please add your Groq API key in the extension settings.');
                resultArea.value = '⚠️ Setup Required\n\n1. Click ⚙️ above to open Settings\n2. Get your FREE API key from Groq\n3. Save it and try again!';
                resultSection.classList.add('visible');
                return;
            }

            // Build smart prompt with user's feedback history
            let systemPrompt = SYSTEM_PROMPT;
            if (typeof SmartPromptBuilder !== 'undefined') {
                systemPrompt = await SmartPromptBuilder.build(style);
            }

            const userPrompt = `Style: ${style}\n\nUser Input:\n${text}`;

            const response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 2048
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    throw new Error('Invalid API key. Please check your settings.');
                } else if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please wait and try again.');
                }
                throw new Error(`API Error: ${response.status} ${errorData.error?.message || ''}`);
            }

            const data = await response.json();
            const result = data.choices[0].message.content.trim();
            resultArea.value = result;
            originalOutput = result;
            resultSection.classList.add('visible');
            btn.textContent = '🔄 Refine Again';

            // Save to IndexedDB
            if (typeof PromptStylerDB !== 'undefined') {
                try {
                    currentRecordId = await PromptStylerDB.saveRefinement({
                        inputPrompt: text,
                        outputPrompt: result,
                        style: style
                    });
                    console.log('PromptStylerDB: Saved refinement #' + currentRecordId);
                } catch (dbError) {
                    console.warn('PromptStylerDB: Failed to save', dbError);
                }
            }

        } catch (error) {
            showError('Failed: ' + error.message);
        } finally {
            isRefining = false;
            btn.disabled = false;
            if (btn.textContent !== '🔄 Refine Again') {
                btn.textContent = '✨ Refine Prompt';
            }
        }
    }

    function showError(msg) {
        const errorDiv = document.getElementById('ps-error');
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';
    }

    function handleCopy() {
        const result = document.getElementById('ps-result').value;
        navigator.clipboard.writeText(result);
        const btn = document.getElementById('ps-copy');
        btn.textContent = '✅ Copied!';
        setTimeout(() => btn.textContent = '📋 Copy', 2000);

        // Track copy as implicit positive feedback
        if (currentRecordId && typeof PromptStylerDB !== 'undefined') {
            PromptStylerDB.updateFeedback(currentRecordId, { wasCopied: true })
                .catch(console.error);
        }
    }

    function handleUse() {
        const result = document.getElementById('ps-result').value;
        const input = document.querySelector(config.inputSelector);
        if (input) {
            if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
                input.value = result;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                input.innerText = result;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        // Track "Use" as strongest positive signal
        if (currentRecordId && typeof PromptStylerDB !== 'undefined') {
            PromptStylerDB.updateFeedback(currentRecordId, { wasUsed: true })
                .catch(console.error);
        }

        closePopup();
    }

    // Create trigger button
    function createRefineButton() {
        const btn = document.createElement('button');
        btn.id = 'promptstyler-refine-btn';
        btn.type = 'button';
        btn.innerHTML = '✨';
        btn.title = 'Refine with PromptStyler';
        btn.style.cssText = `
            position: absolute; right: 52px; bottom: 14px;
            width: 28px; height: 28px; border-radius: 6px; border: none;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white; font-size: 14px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            z-index: 9999; transition: all 0.2s;
            box-shadow: 0 2px 6px rgba(99,102,241,0.3);
        `;
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.1)'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const input = document.querySelector(config.inputSelector);
            let text = '';
            if (input) {
                text = input.tagName === 'TEXTAREA' || input.tagName === 'INPUT'
                    ? input.value : (input.innerText || input.textContent);
            }
            text = text.trim();
            if (!text) {
                alert('Please enter some text first!');
                return;
            }
            injectStyles();
            createPopup(text);
        };
        return btn;
    }

    function injectButton() {
        if (document.getElementById('promptstyler-refine-btn')) return;
        const input = document.querySelector(config.inputSelector);
        if (!input) return;
        let container = input.closest(config.containerSelector) || input.parentElement;
        if (container) {
            if (getComputedStyle(container).position === 'static') {
                container.style.position = 'relative';
            }
            container.appendChild(createRefineButton());
            console.log('PromptStyler: Button injected (with feedback system)');
        }
    }

    // Observer & init
    const observer = new MutationObserver(() => injectButton());
    observer.observe(document.body, { childList: true, subtree: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(injectButton, 1000));
    } else {
        setTimeout(injectButton, 1000);
    }
})();
