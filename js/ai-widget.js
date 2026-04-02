import { getThreads, saveThread } from './store.js';

let config = null;
let currentCourse = null;
let currentLesson = null;
let currentModule = null;

export async function initWidget(appConfig) {
  config = appConfig;
}

export function setContext(course, module, lesson) {
  currentCourse = course;
  currentModule = module;
  currentLesson = lesson;
}

export function isConfigured() {
  return config && config.apiKey;
}

export function bindSectionAskButtons(rootEl) {
  rootEl.querySelectorAll('.section-ask-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.section-ai-zone');
      const panel = section.querySelector('.section-ai-panel');
      if (panel.style.display === 'flex') {
        panel.style.display = 'none';
        btn.textContent = 'Ask about this section';
      } else {
        panel.style.display = 'flex';
        btn.textContent = 'Hide assistant';
        panel.querySelector('.section-ai-input').focus();
      }
    });
  });

  rootEl.querySelectorAll('.section-ai-send').forEach(btn => {
    btn.addEventListener('click', () => {
      const zone = btn.closest('.section-ai-zone');
      handleSectionSend(zone);
    });
  });

  rootEl.querySelectorAll('.section-ai-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const zone = input.closest('.section-ai-zone');
        handleSectionSend(zone);
      }
    });
  });
}

function stripHtmlTags(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function getSectionContent(heading) {
  const main = document.getElementById('main-content');
  const headings = main.querySelectorAll('h2');
  let collecting = false;
  let sectionHtml = '';

  for (const node of main.children) {
    if (node.tagName === 'H2') {
      if (node.textContent.trim() === heading) {
        collecting = true;
        sectionHtml += node.outerHTML;
        continue;
      } else if (collecting) {
        break;
      }
    }
    if (collecting) {
      sectionHtml += node.outerHTML || node.textContent;
    }
  }
  return stripHtmlTags(sectionHtml);
}

function buildSystemPrompt(sectionHeading) {
  const courseTitle = currentCourse.title;
  const moduleTitle = currentModule.title;
  const moduleNum = currentModule.number;
  const lessonTitle = currentLesson.title;

  const sectionText = getSectionContent(sectionHeading);
  const lessonText = stripHtmlTags(currentLesson.content);

  const otherLessons = currentModule.lessons
    .filter(l => l.id !== currentLesson.id)
    .map(l => l.title)
    .join(', ');

  return `You are a training assistant for the "${courseTitle}" course. The user is reading the section "${sectionHeading}" in lesson "${lessonTitle}" (Module ${moduleNum}: ${moduleTitle}). Answer questions about this section and related topics. Be concise and practical.

## Current Section: ${sectionHeading}
${sectionText}

## Full Lesson Context
${lessonText}

## Other Lessons in This Module
Module also covers: ${otherLessons}`;
}

function escapeMinimal(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="ai-code-block"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function renderPanelMessages(zone, messages) {
  const container = zone.querySelector('.section-ai-messages');
  container.innerHTML = messages.map(m => {
    if (m.role === 'loading') {
      return '<div class="ai-msg loading">Thinking...</div>';
    }
    return `<div class="ai-msg ${m.role}">${escapeMinimal(m.content)}</div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function handleSectionSend(zone) {
  const input = zone.querySelector('.section-ai-input');
  const question = input.value.trim();
  if (!question || !config || !config.apiKey) return;

  const heading = zone.dataset.heading;
  input.value = '';

  // Find or create thread for this zone
  let thread = zone._activeThread;
  if (!thread) {
    thread = {
      anchorHeading: heading,
      messages: [],
      timestamp: Date.now(),
      collapsed: true
    };
    zone._activeThread = thread;
  }

  thread.messages.push({ role: 'user', content: question });
  renderPanelMessages(zone, [...thread.messages, { role: 'loading' }]);

  try {
    const systemPrompt = buildSystemPrompt(heading);
    const apiMessages = thread.messages.map(m => ({
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

    thread.messages.push({ role: 'assistant', content: assistantMsg });
    saveThread(currentCourse.id, currentLesson.id, thread);
    renderPanelMessages(zone, thread.messages);

    // Update the embedded thread display above
    updateEmbeddedThread(zone, thread);
  } catch (err) {
    thread.messages.push({ role: 'assistant', content: `Error: ${err.message}` });
    renderPanelMessages(zone, thread.messages);
  }
}

function updateEmbeddedThread(zone, thread) {
  // Find or create the embedded thread block above the ask button
  const section = zone.closest('.section-ai-zone');
  let threadContainer = section.querySelector('.section-embedded-threads');
  if (!threadContainer) return;

  // Re-render the threads for this section
  const allThreads = getThreads(currentCourse.id, currentLesson.id)
    .filter(t => t.anchorHeading === zone.dataset.heading);

  threadContainer.innerHTML = allThreads.map(t => {
    const firstQ = t.messages.find(m => m.role === 'user');
    const preview = firstQ ? firstQ.content.substring(0, 100) + (firstQ.content.length > 100 ? '...' : '') : 'Q&A Thread';
    const isActive = t.timestamp === thread.timestamp;

    const msgHtml = t.messages.map(m =>
      `<div class="embedded-thread-msg ${m.role}">${escapeMinimal(m.content)}</div>`
    ).join('');

    return `<div class="embedded-thread${isActive ? ' expanded' : ''}" data-timestamp="${t.timestamp}">
      <div class="embedded-thread-toggle">${escapeHtml(preview)}</div>
      <div class="embedded-thread-body">${msgHtml}</div>
    </div>`;
  }).join('');

  // Rebind toggles
  threadContainer.querySelectorAll('.embedded-thread-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.closest('.embedded-thread').classList.toggle('expanded');
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
