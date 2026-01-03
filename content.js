// Content Script for PromptStyler
// Injects popup panel directly into AI chat sites

(function () {
    'use strict';

    // System prompt
    const SYSTEM_PROMPT = `You are "PromptStyler", an advanced prompt-refinement system designed to transform unstructured or unclear user prompts into clean, professional, task-optimized prompts.

Your goals:
1. Improve clarity, structure, and precision.
2. Preserve the original meaning of the user's intent.
3. Apply the user-selected prompt style strictly.
4. Never introduce new tasks, assumptions, or extra context.
5. Always keep the rewritten prompt ready for direct use in an LLM.

STRICT RULES:
- Do NOT change or reinterpret the user's task.
- Do NOT add recommendations, analysis, or commentary.
- Do NOT include explanations about what you did.
- Only output the final rewritten prompt in the required style.`;

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
    const RATE_LIMIT_MS = 3000; // 3 seconds between requests
    const MAX_INPUT_LENGTH = 10000; // 10,000 characters max

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
            .ps-body { padding: 32px 36px 40px 36px; display: flex; flex-direction: column; gap: 24px; max-height: calc(85vh - 70px); overflow-y: auto; }
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
            }
            .ps-textarea:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.2); }
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
            .ps-btn-copy {
                background: #22262e; border: 1px solid #2f3441;
                border-radius: 6px; padding: 8px 14px; color: #9ca3af;
                font-size: 13px; cursor: pointer; transition: all 0.2s;
            }
            .ps-btn-copy:hover { color: #fff; border-color: #6366f1; background: #2a2f38; }
            .ps-actions { display: flex; gap: 12px; margin-top: 12px; }
            .ps-btn-use {
                flex: 1; background: #10b981; border: none; border-radius: 10px;
                padding: 14px; color: white; font-weight: 600; font-size: 15px; 
                cursor: pointer; transition: all 0.2s;
            }
            .ps-btn-use:hover { background: #059669; }
            .ps-error { color: #ef4444; font-size: 12px; padding: 8px; background: rgba(239,68,68,0.1); border-radius: 4px; }
            @keyframes psFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes psSlideIn { from { opacity: 0; transform: translate(-50%, -45%); } to { opacity: 1; transform: translate(-50%, -50%); } }
        `;
        document.head.appendChild(style);
    }

    // Create popup HTML
    function createPopup(text) {
        originalText = text;

        const overlay = document.createElement('div');
        overlay.id = 'ps-popup-overlay';
        overlay.onclick = closePopup;

        const popup = document.createElement('div');
        popup.id = 'ps-popup';
        popup.onclick = (e) => e.stopPropagation();
        popup.innerHTML = `
            <div class="ps-header">
                <div class="ps-logo">✨ PromptStyler</div>
                <button class="ps-close" id="ps-close">&times;</button>
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
                        <button class="ps-btn-copy" id="ps-copy">📋 Copy</button>
                    </div>
                    <textarea class="ps-textarea" id="ps-result" rows="5" readonly></textarea>
                    <div class="ps-actions">
                        <button class="ps-btn-use" id="ps-use">✅ Use This Prompt</button>
                    </div>
                </div>
                <div class="ps-error" id="ps-error" style="display:none;"></div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(popup);

        // Event listeners
        document.getElementById('ps-close').onclick = closePopup;
        document.getElementById('ps-refine').onclick = handleRefine;
        document.getElementById('ps-copy').onclick = handleCopy;
        document.getElementById('ps-use').onclick = handleUse;

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
        const overlay = document.getElementById('ps-popup-overlay');
        const popup = document.getElementById('ps-popup');
        if (overlay) overlay.remove();
        if (popup) popup.remove();
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

        try {
            isRefining = true;
            btn.disabled = true;
            btn.textContent = '⏳ Refining...';
            errorDiv.style.display = 'none';

            const fullPrompt = `${SYSTEM_PROMPT}\n\nStyle: ${style}\n\nUser Input:\n${text}`;

            const response = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: fullPrompt }],
                    model: 'openai',
                    seed: 42
                })
            });

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            let result = (await response.text()).trim();

            // Clean response - remove Pollinations deprecation notices
            const warningPatterns = [
                /⚠️\s*\*{0,2}IMPORTANT NOTICE\*{0,2}\s*⚠️[\s\S]*?work normally\.?/gi,
                /\*{0,2}IMPORTANT NOTICE\*{0,2}[\s\S]*?work normally\.?/gi,
                /please migrate to[\s\S]*?enter\.pollinations\.ai[\s\S]*?work normally\.?/gi,
                /The Pollinations legacy text API[\s\S]*?work normally\.?/gi,
                /deprecated for[\s\S]*?authenticated users[\s\S]*?work normally\.?/gi
            ];
            for (const pattern of warningPatterns) {
                result = result.replace(pattern, '').trim();
            }
            result = result.replace(/^\n+/, '').trim();

            resultArea.value = result;
            resultSection.classList.add('visible');
            btn.textContent = '🔄 Refine Again';

        } catch (error) {
            showError('Failed: ' + error.message);
        } finally {
            isRefining = false;
            btn.disabled = false;
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
            console.log('PromptStyler: Button injected');
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
