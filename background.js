// Background Service Worker for PromptStyler
// Handles context menu only (inline refinement is done in content script)

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
        chrome.storage.local.set({
            pendingText: info.selectionText.trim(),
            source: 'contextMenu'
        });
    }
});
