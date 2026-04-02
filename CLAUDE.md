# Interactive Training Platform

## Project Overview

This is a static-file interactive training platform that renders courses from JSON content files in `courses/`. It has no build step, no backend, and no dependencies. Serve with `make serve` and open in a browser.

## Architecture

- `index.html` — HTML shell
- `css/style.css` — all styles (dark theme)
- `js/app.js` — entry point, routing, orchestration
- `js/renderer.js` — lesson rendering, syntax highlighting, embedded Q&A injection
- `js/exercises.js` — quiz and config-editor validation
- `js/ai-widget.js` — per-section AI chat with Anthropic API
- `js/store.js` — localStorage persistence (progress, Q&A threads)
- `courses/index.json` — manifest listing course JSON filenames
- `courses/*.json` — course content files
- `config.json` — platform config (no secrets)
- `config.local.json` — API key (gitignored)

## Creating a New Course

When asked to create a training course for a technology, follow this process. The goal is to produce a single JSON file in `courses/` that the platform renders automatically.

### Step 1: Understand the audience

Ask who the course is for and what their starting knowledge level is. A course for someone who has a working setup but doesn't understand it (like the Squid course) is very different from a course for a complete beginner or an experienced user learning advanced patterns.

### Step 2: Design the curriculum

Before writing any content, design the full module/lesson structure. Aim for:

- **3-5 modules** that progress from foundational concepts to advanced topics
- **3-5 lessons per module**, each focused on a single concept
- **Progressive depth**: Module 1 explains what things are and why they exist. Module 2 walks through the user's actual setup. Later modules cover features they'll encounter but may not need yet.

Structure the modules as a learning journey, not a reference manual. Each lesson should build on prior ones. Example pattern that works well:

1. **Fundamentals** — what is this technology, how does it work conceptually, what are the core abstractions
2. **Your Setup Explained** — walk through the user's actual configuration line by line, explaining what each piece does and why it's there
3. **Beyond the Basics** — adjacent features the user will encounter: caching, auth, rate limiting, debugging, etc.
4. **Advanced Configurations** — complex setups that require deeper understanding: TLS interception, proxy chaining, dynamic configuration, etc.

Module 2 ("Your Setup") is the anchor — it gives the user immediate, practical understanding of what they already have. If the user doesn't have an existing setup, replace this with a "Building Your First Config" module that constructs one step by step.

### Step 3: Write the content

Each lesson has an HTML `content` field. Follow these guidelines:

**Structure each lesson with `<h2>` sections.** The platform injects AI assistant buttons after each `<h2>` section, so well-scoped headings directly improve the interactive experience. Aim for 3-5 `<h2>` sections per lesson.

**Tone**: Conversational and practical, not textbook-dry. Explain *why* things work the way they do, not just *what* they do. Use analogies when they help. Reference the user's actual context when possible.

**Length**: 200-500 words per lesson. Enough to explain the concept thoroughly but not so much that the user loses focus. If a lesson is getting long, split it into two.

**Use these HTML elements:**
- `<h2>` — section headings (critical for AI widget scoping)
- `<p>` — paragraphs
- `<strong>` — emphasis for key terms
- `<code>` — inline code, commands, config values
- `<ul>` / `<ol>` — lists
- `<div class="config-block">` — multi-line code/config blocks (gets automatic syntax highlighting with comments in gray, first-word in blue, rest in green)

**Teach the "gotchas."** The most valuable parts of the Squid course were details like: "the leading dot in `.github.com` is important — without it, subdomains won't match" or "delay pools only work for HTTP, not HTTPS CONNECT tunnels." Every technology has these non-obvious details that catch people. Find them and teach them.

**Connect concepts across lessons.** Reference earlier lessons when relevant: "As we covered in the CONNECT tunnel lesson, the proxy can't see inside encrypted traffic — this is why caching doesn't work for HTTPS." This reinforces learning and shows how pieces fit together.

### Step 4: Write exercises

Every lesson should have 1-2 exercises. Mix types based on what the lesson teaches:

**Use quizzes for conceptual understanding:**
- "What happens when X?"
- "Which option does Y?"
- "Given this config, what is the result?"

Quiz schema:
```json
{
  "type": "quiz",
  "question": "The question text (can include <code> and <div class='config-block'> for inline config)",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct": 0,
  "explanation": "Why the correct answer is correct and why wrong answers are wrong"
}
```

**Use config-editor exercises for hands-on practice:**
- "Fix this broken config"
- "Add a new feature to this config"
- "Write a config from scratch given these requirements"

Config-editor schema:
```json
{
  "type": "config-editor",
  "prompt": "What the user needs to do (can include HTML)",
  "startingConfig": "# Pre-populated config text\nthe user edits this",
  "validators": [
    {
      "regex": "pattern_that_must_match",
      "flags": "m",
      "message": "Short error name",
      "hint": "Helpful hint shown when this validator fails"
    }
  ],
  "solution": "# The correct config",
  "solutionNotes": "Explanation of why this is correct (can include <code> tags)"
}
```

Validator tips:
- Validators run in order; the first failure's hint is shown
- Use `flags: "m"` for multiline matching
- Use `flags: "s"` when you need `.` to match newlines
- Regex must match the user's input for the validator to pass
- For "must NOT contain X" checks, use a negative lookahead: `^(?!.*bad_pattern)`
- Keep hints actionable: tell the user what to do, not just what's wrong

**Exercise design principles:**
- The exercise should test the concept the lesson just taught, not something tangential
- Config-editor starting configs should be realistic — not empty textareas
- Provide enough scaffolding that the user knows where to add their changes
- Solutions should include notes explaining the "why," not just the "what"

### Step 5: Assemble the JSON

The full course schema:
```json
{
  "id": "kebab-case-id",
  "title": "Course Title",
  "description": "One-line description shown on course picker",
  "modules": [
    {
      "id": "module-id",
      "number": 1,
      "title": "Module Title",
      "lessons": [
        {
          "id": "lesson-id",
          "title": "Lesson Title",
          "content": "<h2>First Section</h2><p>Content...</p><h2>Second Section</h2><p>More content...</p>",
          "exercises": [ ... ]
        }
      ]
    }
  ]
}
```

After creating the JSON file:
1. Place it in `courses/`
2. Add its filename to `courses/index.json`
3. Run `make validate` to confirm all course JSON files parse correctly
4. Verify it loads: `make serve` and open in browser

### Quality Checklist

Before considering a course complete:

- [ ] Every lesson has at least one exercise
- [ ] No lesson exceeds ~500 words (split if needed)
- [ ] Each `<h2>` section is scoped tightly enough to be a useful AI assistant context
- [ ] Config-editor validators have been tested — the solution must pass all validators
- [ ] Quiz correct indices are right (0-indexed)
- [ ] Gotchas and non-obvious details are called out explicitly
- [ ] Later lessons reference earlier ones where concepts connect
- [ ] The course can be completed in order without needing to jump around
- [ ] JSON is valid (`make validate` passes)
