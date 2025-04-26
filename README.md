# Local AI Agent Chat Interface with Custom Modes

This project provides a web-based chat interface for interacting with local large language models (LLMs) via Ollama. It supports custom chat modes, image generation, code generation, and file reading.

## Project Structure

```
/project-root
├── /backend
│   ├── src
│   │   ├── index.js
│   │   ├── api/
│   │   ├── services/
│   │   └── utils/
│   ├── package.json
│   └── Dockerfile (optional)
├── /frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.js
│   ├── package.json
│   └── .env
├── /tests
│   ├── e2e/
│   ├── integration/
│   └── unit/
├── .gitignore
├── README.md
└── package.json
```

## Getting Started

### 1. Install Ollama

- Download and install Ollama from [https://ollama.com/download](https://ollama.com/download)
- Start Ollama server: `ollama serve`
- Pull a model (e.g., Deepseek): `ollama pull deepseek` or `ollama pull deepseek-coder`

### 2. Backend Setup

- `cd backend`
- `npm install`
- `npm run dev`

### 3. Frontend Setup

- `cd frontend`
- `npm install`
- `npm run dev`

### 4. Running Tests

- `cd tests`
- `npm install`
- Run Playwright tests as needed

## Features
- Chat with local LLMs (Ollama)
- Custom chat modes (Creative, Code, General)
- Image generation
- Code generation & explanation
- File reading for context

## Roadmap
- Conversation history
- Model management
- Advanced modes
- Plugin system

---

## Ollama Model Management

- List models: `ollama list`
- Pull new model: `ollama pull <model>`
- Remove model: `ollama rm <model>`

Refer to [Ollama documentation](https://ollama.com/docs) for details.
