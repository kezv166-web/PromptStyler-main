/**
 * PromptStyler Database Module
 * 
 * IndexedDB wrapper for storing refinement feedback.
 * Shared by popup.js and content.js via manifest/script tags.
 * 
 * Usage:
 *   await PromptStylerDB.init();
 *   const id = await PromptStylerDB.saveRefinement({ ... });
 *   await PromptStylerDB.updateFeedback(id, { rating: 1 });
 *   const examples = await PromptStylerDB.getTopExamples('PROFESSIONAL', 3);
 */

const PromptStylerDB = (() => {
    const DB_NAME = 'PromptStylerDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'refinements';

    let db = null;

    // ─── Init ────────────────────────────────────────────
    function init() {
        return new Promise((resolve, reject) => {
            if (db) { resolve(db); return; }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    const store = database.createObjectStore(STORE_NAME, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    store.createIndex('style', 'style', { unique: false });
                    store.createIndex('rating', 'rating', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('style_rating', ['style', 'rating'], { unique: false });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                // Run cleanup on every init
                cleanup().then(() => resolve(db)).catch(() => resolve(db));
            };

            request.onerror = (event) => {
                console.error('PromptStylerDB: Failed to open', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // ─── Save a refinement ───────────────────────────────
    function saveRefinement({ inputPrompt, outputPrompt, style }) {
        return new Promise((resolve, reject) => {
            if (!db) { reject(new Error('DB not initialized')); return; }

            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            const record = {
                timestamp: Date.now(),
                inputPrompt: inputPrompt || '',
                outputPrompt: outputPrompt || '',
                style: style || 'PROFESSIONAL',
                rating: 0,          // 0 = no feedback, 1 = thumbs up, -1 = thumbs down
                wasEdited: false,
                editedVersion: '',
                wasCopied: false,
                wasUsed: false
            };

            const request = store.add(record);
            request.onsuccess = () => resolve(request.result); // returns the id
            request.onerror = () => reject(request.error);
        });
    }

    // ─── Update feedback on a record ─────────────────────
    function updateFeedback(id, updates) {
        return new Promise((resolve, reject) => {
            if (!db) { reject(new Error('DB not initialized')); return; }

            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const getReq = store.get(id);

            getReq.onsuccess = () => {
                const record = getReq.result;
                if (!record) { reject(new Error('Record not found')); return; }

                // Merge updates
                if (updates.rating !== undefined) record.rating = updates.rating;
                if (updates.wasEdited !== undefined) record.wasEdited = updates.wasEdited;
                if (updates.editedVersion !== undefined) record.editedVersion = updates.editedVersion;
                if (updates.wasCopied !== undefined) record.wasCopied = updates.wasCopied;
                if (updates.wasUsed !== undefined) record.wasUsed = updates.wasUsed;

                const putReq = store.put(record);
                putReq.onsuccess = () => resolve(record);
                putReq.onerror = () => reject(putReq.error);
            };

            getReq.onerror = () => reject(getReq.error);
        });
    }

    // ─── Get top examples for a style ────────────────────
    function getTopExamples(style, limit = 3) {
        return new Promise((resolve, reject) => {
            if (!db) { resolve([]); return; }

            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const results = [];

            // Get all records and filter/sort in memory
            // (IndexedDB compound index queries are limited)
            const request = store.index('style').openCursor(IDBKeyRange.only(style));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const r = cursor.value;
                    // Only include positive signals
                    if (r.rating === 1 || r.wasCopied || r.wasUsed || r.wasEdited) {
                        results.push(r);
                    }
                    cursor.continue();
                } else {
                    // Sort: edited (gold) first, then by rating + recency
                    results.sort((a, b) => {
                        // Gold (edited) always first
                        if (a.wasEdited && !b.wasEdited) return -1;
                        if (!a.wasEdited && b.wasEdited) return 1;
                        // Then by rating
                        if (a.rating !== b.rating) return b.rating - a.rating;
                        // Then by recency
                        return b.timestamp - a.timestamp;
                    });
                    resolve(results.slice(0, limit));
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    // ─── Get stats for options page ──────────────────────
    function getStats() {
        return new Promise((resolve, reject) => {
            if (!db) { resolve({ total: 0, byStyle: {} }); return; }

            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const stats = { total: 0, byStyle: {}, positive: 0, negative: 0, edited: 0 };

            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const r = cursor.value;
                    stats.total++;
                    stats.byStyle[r.style] = (stats.byStyle[r.style] || 0) + 1;
                    if (r.rating === 1) stats.positive++;
                    if (r.rating === -1) stats.negative++;
                    if (r.wasEdited) stats.edited++;
                    cursor.continue();
                } else {
                    resolve(stats);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ─── Auto-cleanup policy ─────────────────────────────
    function cleanup() {
        return new Promise((resolve, reject) => {
            if (!db) { resolve(); return; }

            const now = Date.now();
            const DAYS_90 = 90 * 24 * 60 * 60 * 1000;
            const DAYS_30 = 30 * 24 * 60 * 60 * 1000;

            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            let deletedCount = 0;

            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const r = cursor.value;
                    const age = now - r.timestamp;
                    let shouldDelete = false;

                    // Gold (edited) — keep forever, but handled by cap below
                    if (r.wasEdited) {
                        // Never auto-delete edited records by age
                    }
                    // Negative — delete after 30 days
                    else if (r.rating === -1) {
                        shouldDelete = age > DAYS_30;
                    }
                    // No feedback — delete after 30 days
                    else if (r.rating === 0 && !r.wasCopied && !r.wasUsed) {
                        shouldDelete = age > DAYS_30;
                    }
                    // Positive (non-edited) — delete after 90 days
                    else if (r.rating === 1 || r.wasCopied || r.wasUsed) {
                        shouldDelete = age > DAYS_90;
                    }

                    if (shouldDelete) {
                        cursor.delete();
                        deletedCount++;
                    }
                    cursor.continue();
                } else {
                    if (deletedCount > 0) {
                        console.log(`PromptStylerDB: Cleaned up ${deletedCount} old records`);
                    }
                    resolve();
                }
            };

            request.onerror = () => resolve(); // Don't fail on cleanup errors
        });
    }

    // ─── Clear all data ──────────────────────────────────
    function clearAll() {
        return new Promise((resolve, reject) => {
            if (!db) { resolve(); return; }

            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    return { init, saveRefinement, updateFeedback, getTopExamples, getStats, cleanup, clearAll };
})();

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.PromptStylerDB = PromptStylerDB;
}
