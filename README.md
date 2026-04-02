# Interactive Training Platform

A reusable, static-file training platform that renders interactive training modules from pluggable JSON content files. Includes an AI assistant for contextual follow-up questions scoped to individual sections, with persistent state across sessions.

## Quick Start

```bash
make serve
# Open http://localhost:8080
```

Or with a custom port:

```bash
make serve PORT=9000
```

## AI Assistant

The platform includes an inline AI assistant that lets you ask follow-up questions about any section. To enable it, create a `config.local.json` (gitignored) with your API key:

```json
{
  "apiKey": "your-anthropic-api-key"
}
```

The assistant is scoped per-section — each `<h2>` section gets its own "Ask about this section" button. Q&A threads are persisted in localStorage and displayed inline below the section where they were asked.

## Creating Training Modules

Training content is decoupled from the platform. To create a new module:

1. Add a JSON file to `content/` following the schema below
2. Add the filename to `content/index.json`

### Content Schema

```json
{
  "id": "my-module",
  "title": "Module Title",
  "description": "Short description shown on the course picker",
  "modules": [
    {
      "id": "basics",
      "number": 1,
      "title": "The Basics",
      "lessons": [
        {
          "id": "intro",
          "title": "Introduction",
          "content": "<h2>Section Heading</h2><p>HTML content...</p>",
          "exercises": []
        }
      ]
    }
  ]
}
```

### Exercise Types

**Quiz:**
```json
{
  "type": "quiz",
  "question": "What does X do?",
  "options": ["A", "B", "C", "D"],
  "correct": 0,
  "explanation": "A is correct because..."
}
```

**Config Editor:**
```json
{
  "type": "config-editor",
  "prompt": "Fix the config below...",
  "startingConfig": "# starting content\n...",
  "validators": [
    { "regex": "expected_pattern", "flags": "m", "hint": "Hint shown on failure" }
  ],
  "solution": "# correct config\n...",
  "solutionNotes": "Explanation of the solution"
}
```

## Project Structure

```
interactive-training/
├── index.html              # HTML shell
├── config.json             # Platform config (no secrets)
├── config.local.json       # API key (gitignored)
├── Makefile                # make serve
├── css/
│   └── style.css           # Dark theme, all component styles
├── js/
│   ├── app.js              # Entry point, routing, orchestration
│   ├── renderer.js         # Lesson rendering, syntax highlighting
│   ├── exercises.js        # Quiz + config-editor validation
│   ├── ai-widget.js        # Per-section AI chat, Anthropic API
│   └── store.js            # localStorage persistence
└── content/
    ├── index.json          # Course manifest
    └── squid-proxy.json    # Example: Squid proxy training
```

## Features

- Dark theme (Tokyo Night-inspired)
- Pluggable JSON content — no code changes to add new training modules
- Two exercise types: multiple-choice quizzes and config editor with regex validation
- Per-section AI assistant with context-aware responses
- AI-generated titles for Q&A threads
- Persistent progress and Q&A threads (localStorage)
- Syntax highlighting for config blocks
- Responsive layout with collapsible sidebar
- No build step, no dependencies — just a static file server
