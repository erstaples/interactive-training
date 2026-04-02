import { getThreads, saveThread } from './store.js';

let config = null;
let currentCourse = null;
let currentLesson = null;
let currentModule = null;
let activeThread = null;

export async function initWidget(appConfig) {
  config = appConfig;

  const toggle = document.getElementById('ai-toggle');
  const panel = document.getElementById('ai-panel');
  const close = document.getElementById('ai-close');
  const send = document.getElementById('ai-send');
  const input = document.getElementById('ai-input');

  toggle.addEventListener('click', () => {
    toggle.style.display = 'none';
    panel.style.display = 'flex';
    input.focus();
  });

  close.addEventListener('click', () => {
    panel.style.display = 'none';
    toggle.style.display = 'block';
  });

  send.addEventListener('click', () => handleSend());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
}

export function setContext(course, module, lesson) {
  currentCourse = course;
  currentModule = module;
  currentLesson = lesson;
  activeThread = null;

  // Reset message display
  const messages = document.getElementById('ai-messages');
  messages.innerHTML = '';

  // Hide panel, show toggle
  document.getElementById('ai-panel').style.display = 'none';
  document.getElementById('ai-toggle').style.display = 'block';

  if (!config || !config.apiKey) {
    document.getElementById('ai-widget').style.display = 'block';
    messages.innerHTML = '<div class="ai-widget-setup">Configure your API key in config.json to enable AI assistance</div>';
    document.getElementById('ai-send').disabled = true;
    return;
  }

  document.getElementById('ai-widget').style.display = 'block';
  document.getElementById('ai-send').disabled = false;
}

function getScrollAnchorHeading() {
  const main = document.getElementById('main-content');
  const headings = main.querySelectorAll('h2');
  let closest = null;
  const scrollTop = main.scrollTop;

  headings.forEach(h2 => {
    if (h2.offsetTop <= scrollTop + 100) {
      closest = h2.textContent.trim();
    }
  });
  return closest || (headings.length > 0 ? headings[0].textContent.trim() : 'General');
}

function stripHtmlTags(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function buildSystemPrompt() {
  const courseTitle = currentCourse.title;
  const moduleTitle = currentModule.title;
  const moduleNum = currentModule.number;
  const lessonTitle = currentLesson.title;

  const lessonText = stripHtmlTags(currentLesson.content);

  const otherLessons = currentModule.lessons
    .filter(l => l.id !== currentLesson.id)
    .map(l => l.title)
    .join(', ');

  return `You are a training assistant for the "${courseTitle}" course. The user is currently on lesson "${lessonTitle}" in Module ${moduleNum}: ${moduleTitle}. Answer questions about the lesson content and related topics. Be concise and practical.

## Current Lesson Content
${lessonText}

## Other Lessons in This Module
Module also covers: ${otherLessons}`;
}

function renderMessages(messages) {
  const container = document.getElementById('ai-messages');
  container.innerHTML = messages.map(m => {
    if (m.role === 'loading') {
      return '<div class="ai-msg loading">Thinking...</div>';
    }
    return `<div class="ai-msg ${m.role}">${escapeMinimal(m.content)}</div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function escapeMinimal(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

async function handleSend() {
  const input = document.getElementById('ai-input');
  const question = input.value.trim();
  if (!question || !config || !config.apiKey) return;

  input.value = '';
  const anchorHeading = getScrollAnchorHeading();

  if (!activeThread) {
    activeThread = {
      anchorHeading,
      messages: [],
      timestamp: Date.now(),
      collapsed: true
    };
  }

  activeThread.messages.push({ role: 'user', content: question });

  // Show messages with loading indicator
  const displayMessages = [...activeThread.messages, { role: 'loading' }];
  renderMessages(displayMessages);

  try {
    const systemPrompt = buildSystemPrompt();
    const apiMessages = activeThread.messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    const response = await fetch(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: apiMessages
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const assistantMsg = data.content[0].text;

    activeThread.messages.push({ role: 'assistant', content: assistantMsg });
    saveThread(currentCourse.id, currentLesson.id, activeThread);
    renderMessages(activeThread.messages);
  } catch (err) {
    activeThread.messages.push({ role: 'assistant', content: `Error: ${err.message}` });
    renderMessages(activeThread.messages);
  }
}
