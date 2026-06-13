# ✨ PromptStyler

> Transform messy, unstructured prompts into clean, professional, task-optimized instructions with one click. Now powered by a local feedback loop to learn your style preferences!

## 🌟 Why PromptStyler?

Crafting the perfect prompt can be time-consuming. PromptStyler simplifies this by applying proven prompt engineering techniques automatically. It uses **Groq's Llama 3.3 70B** model for ultra-fast, high-quality prompt refinement.

With version 1.4, the extension now features a **local feedback and learning loop**. By analyzing your feedback, the extension automatically injects your top-rated prompts into future requests as few-shot examples—tailoring the results to your unique writing style!

---

## ✨ Features

- **🎨 7 Prompt Styles:** Professional, Markdown, JSON, TOON, Persona, Chain-of-Thought, and Few-Shot.
- **⚡ Ultra-Fast Refinement:** Instant responses (~500ms) powered by Groq's high-speed inference engine.
- **🔌 Seamless Integration:** Use the toolbar popup, right-click context menu, or the floating ✨ button directly on ChatGPT, Claude, and Gemini.
- **🧠 Local Learning Loop:** PromptStyler learns from your explicit signals (👍/👎 ratings) and implicit signals (copying, using, or editing results) to adapt future outputs.
- **✏️ Result Editor:** Click the ✏️ Edit button to manually tweak refined outputs. These tweaks are saved locally as the "gold standard" reference for future prompt generations.
- **🛡️ Privacy First:** Your data is yours. API keys and feedback history are stored 100% locally on your machine (Chrome Sync & IndexedDB). No middleman servers or third-party trackers are used.

---

## 🚀 Getting Started

### 1. Install the Extension
1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **"Developer mode"** (toggle in the top-right corner).
4. Click **"Load unpacked"** and select the `PromptStyler-main` project folder.

### 2. Get Your Free API Key
1. Visit [console.groq.com/keys](https://console.groq.com/keys).
2. Sign up for a free account (no credit card required).
3. Click **"Create API Key"** and copy the key.

### 3. Configure PromptStyler
1. Open the PromptStyler extension popup (toolbar icon) or click the ⚙️ gear icon inside the injected chat modal.
2. Paste your Groq API key and click **Save**.
3. *Done!* You're ready to start refining.

---

## 💡 How to Use

### Option 1: Extension Popup
1. Click the PromptStyler icon in your browser toolbar.
2. Paste or type your raw prompt.
3. Select a style (e.g., Professional, Markdown, JSON) and click **✨ Refine Prompt**.
4. Rate it (👍/👎) or click **✏️ Edit** to polish it. Copy the output when ready!

### Option 2: On AI Chat Sites (ChatGPT, Claude, Gemini)
1. Type a messy prompt into the chat window's input box.
2. Click the floating **✨** button near the chat input.
3. Choose a style, hit refine, and click **Use This Prompt** to automatically replace your input text.

### Option 3: Right-Click Selection
1. Highlight any text on a webpage.
2. Right-click and choose **"Refine with PromptStyler"**.
3. The popup opens with the selected text preloaded.

---

## 🧠 How the Local Learning Loop Works

PromptStyler stores your refinements in a local browser database (**IndexedDB**).

1. **Explicit Feedback:** Rating an output **👍** or **👎** tells the model which structures you prefer or dislike.
2. **Implicit Feedback:** Copying a prompt or clicking *Use This Prompt* registers as a positive indicator.
3. **Gold-Standard Edits:** Clicking **✏️ Edit** and modifying the output tells the system *exactly* how your final prompt should look. This custom output is treated as the highest-priority template.
4. **Smart System Prompts:** When you click "Refine", PromptStyler queries your local DB for your top 3 preferred history entries for the selected style and appends them as few-shot learning context for the model.

### Storage & Pruning Policy
To prevent browser storage bloat, an automatic cleanup policy runs on extension startup:
- **User-Edited (Gold) Prompts:** Kept indefinitely (capped at 10 per style).
- **Positive Prompts (Liked/Copied/Used):** Pruned after 90 days.
- **Negative/Ignored Prompts:** Pruned after 30 days.

*You can view your stats or wipe the local database at any time from the extension's **Settings (⚙️)** page.*

---

## 🔧 Technical Details

- **Model:** `llama-3.3-70b-versatile` via Groq Cloud API.
- **Storage Syncing:** API keys are stored in `chrome.storage.sync` so they sync across all browsers signed into your Chrome Profile.
- **Memory Optimization:** Transient state data uses `chrome.storage.session` to reduce disk write cycles.
- **No Dependencies:** Built with zero external node packages or framework runtimes, keeping the extension extremely lightweight.

---

## 📦 For Developers & Publishing

To package a clean build for the Chrome Web Store (excluding dev, test, and git folders):

1. Open PowerShell in the project directory.
2. Run the build script:
   ```powershell
   ./build.ps1
   ```
3. A clean zip file named `PromptStyler-v1.4.zip` will be generated in the root directory, ready to be uploaded to the [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole).

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs or suggest features via Issues
- Submit Pull Requests with code/style improvements
- Share your prompt engineering system instructions

---

## 📄 License

MIT License - feel free to use, modify, and distribute.

---

Made with ❤️ for better prompts