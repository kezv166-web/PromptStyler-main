/**
 * PromptStyler Smart Prompt Builder
 * 
 * Enhances the system prompt by injecting the user's top-rated examples
 * as few-shot context. This makes Groq adapt to user preferences over time.
 * 
 * Depends on: shared/db.js (PromptStylerDB) and shared/system_prompt.js
 */

const SmartPromptBuilder = (() => {

    /**
     * Build an enhanced system prompt with user's best examples
     * @param {string} style - The selected style (e.g. 'PROFESSIONAL')
     * @param {number} maxExamples - Max examples to inject (default 3)
     * @returns {Promise<string>} Enhanced system prompt
     */
    async function build(style, maxExamples = 3) {
        const basePrompt = window.PROMPTSTYLER_SYSTEM_PROMPT ||
            'You are PromptStyler, a prompt refinement assistant.';

        try {
            // Ensure DB is ready
            if (typeof PromptStylerDB === 'undefined') {
                return basePrompt;
            }

            await PromptStylerDB.init();
            const examples = await PromptStylerDB.getTopExamples(style, maxExamples);

            if (examples.length === 0) {
                return basePrompt;
            }

            // Build few-shot context from user's history
            let fewShotContext = '\n\n-----------------------------------------------\n';
            fewShotContext += 'USER\'S PREFERRED EXAMPLES FOR THIS STYLE\n';
            fewShotContext += '-----------------------------------------------\n';
            fewShotContext += 'The user has rated these as good outputs. Match their preferences:\n\n';

            examples.forEach((ex, i) => {
                // Use edited version if available (gold standard), otherwise original output
                const preferredOutput = ex.wasEdited && ex.editedVersion
                    ? ex.editedVersion
                    : ex.outputPrompt;

                fewShotContext += `Example ${i + 1}:\n`;
                fewShotContext += `Input: ${truncate(ex.inputPrompt, 200)}\n`;
                fewShotContext += `Output: ${truncate(preferredOutput, 500)}\n`;

                if (ex.wasEdited) {
                    fewShotContext += `(Note: User manually edited this output — treat as gold standard)\n`;
                }
                fewShotContext += '\n';
            });

            fewShotContext += 'Adapt your style to match these user preferences while following the style rules above.\n';

            console.log(`PromptStyler: Injecting ${examples.length} examples for ${style}`);
            return basePrompt + fewShotContext;

        } catch (error) {
            console.warn('PromptStyler: Smart prompt failed, using base prompt', error);
            return basePrompt;
        }
    }

    /**
     * Truncate text to max length with ellipsis
     */
    function truncate(text, maxLen) {
        if (!text || text.length <= maxLen) return text || '';
        return text.substring(0, maxLen) + '...';
    }

    return { build };
})();

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.SmartPromptBuilder = SmartPromptBuilder;
}
