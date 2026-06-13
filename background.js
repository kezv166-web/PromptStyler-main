// Background Service Worker for PromptStyler
// Handles context menu and message routing

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'refine-prompt',
        title: '✨ Refine with PromptStyler',
        contexts: ['selection']
    });
    console.log('PromptStyler: Context menu created');
});

// Handle context menu click - stores text for popup to pick up
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'refine-prompt' && info.selectionText) {
        // Use session storage (memory-only, cleared on browser close)
        // Fall back to local if session is unavailable
        const data = {
            pendingText: info.selectionText.trim(),
            source: 'contextMenu'
        };

        if (chrome.storage.session) {
            chrome.storage.session.set(data);
        } else {
            chrome.storage.local.set(data);
        }
    }
});

// Handle messages from content script (e.g. open settings)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openOptions') {
        chrome.runtime.openOptionsPage();
    }
});
