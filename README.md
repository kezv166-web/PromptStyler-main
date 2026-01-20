# ✨ PromptStyler

> Transform messy, unstructured prompts into clean, professional, task-optimized instructions with one click.

## 🌟 Why PromptStyler?

Crafting the perfect prompt can be time-consuming. PromptStyler simplifies this by applying proven prompt engineering techniques automatically. It uses **Groq's Llama 3.3 70B** model for ultra-fast, high-quality prompt refinement.

## ✨ Features

-   **🎨 7 Prompt Styles**: Professional, Markdown, JSON, TOON, Persona, Chain-of-Thought, and Few-Shot
-   **⚡ Instant Refinement**: Ultra-fast responses powered by Groq's inference engine
-   **🔌 Works Everywhere**: Use the popup, right-click context menu, or the ✨ button on ChatGPT/Claude/Gemini
-   **🔑 Free API Access**: Each user gets 14,400 free requests per day with their own Groq API key
-   **🛡️ Privacy First**: Your prompts are sent directly to Groq - no middleman servers

## 🚀 Getting Started

### 1. Install the Extension

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the project folder

### 2. Get Your Free API Key

1. Visit [console.groq.com](https://console.groq.com/keys)
2. Sign up for a free account (no credit card required)
3. Create a new API key

### 3. Configure PromptStyler

1. Click the PromptStyler extension icon
2. Click the ⚙️ Settings button
3. Paste your Groq API key and click Save
4. You're ready to go!

## 💡 How to Use

### Option 1: Extension Popup
1. Click the PromptStyler icon in your browser toolbar
2. Paste or type your raw prompt
3. Select a style (Professional, Markdown, JSON, etc.)
4. Click "✨ Refine Prompt"
5. Copy the refined result!

### Option 2: On AI Chat Sites
When you're on ChatGPT, Claude, or Gemini:
1. Type your prompt in the chat input
2. Click the ✨ button that appears
3. Select a style and refine
4. Click "Use This Prompt" to insert directly

### Option 3: Right-Click Menu
1. Select any text on a webpage
2. Right-click and choose "Refine with PromptStyler"
3. The popup opens with your text loaded

## 🎨 Available Styles

| Style | Description |
|-------|-------------|
| **Professional** | Clean, concise, business-ready instructions |
| **Markdown** | Structured with headers, lists, and sections |
| **JSON** | Strict JSON format for programmatic use |
| **TOON** | Token-Oriented Object Notation (compact structured format) |
| **Persona** | Adds a role/expert persona to the prompt |
| **Chain-of-Thought** | Includes reasoning steps for complex problems |
| **Few-Shot** | Pattern-based with examples |

## 🔧 Technical Details

### API Usage
- **Provider**: Groq Cloud
- **Model**: Llama 3.3 70B Versatile
- **Free Tier**: 14,400 requests/day, 500K tokens/day per user
- **Latency**: ~500ms average response time

### Privacy
- Your API key is stored locally in Chrome storage
- Prompts are sent directly to Groq's API
- No data is collected or stored by PromptStyler

## 📁 Project Structure

```
PromptStyler/
├── manifest.json      # Extension configuration
├── popup.html/js/css  # Main popup interface
├── options.html/js    # Settings page with API key management
├── content.js         # Injected script for AI chat sites
├── background.js      # Service worker for context menu
└── icons/             # Extension icons
```

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs or suggest features via Issues
- Submit Pull Requests with improvements
- Share your prompt engineering tips

## 📄 License

MIT License - feel free to use, modify, and distribute.

---

Made with ❤️ for better prompts