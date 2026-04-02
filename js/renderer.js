import { getThreads } from './store.js';

export function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function highlightConfig(text) {
  return text
    .split('\n')
    .map(line => {
      if (line.trimStart().startsWith('#')) {
        return `<span style="color:var(--comment-color)">${escapeHtml(line)}</span>`;
      }
      const match = line.match(/^(\s*)(\S+)(.*)/);
      if (match) {
        return `${escapeHtml(match[1])}<span style="color:var(--directive-color)">${escapeHtml(match[2])}</span><span style="color:var(--value-color)">${escapeHtml(match[3])}</span>`;
      }
      return escapeHtml(line);
    })
    .join('\n');
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

function renderEmbeddedThreads(threads, heading) {
  const matching = threads.filter(t => t.anchorHeading === heading);
  if (matching.length === 0) return '';

  return matching.map(thread => {
    const firstQuestion = thread.messages.find(m => m.role === 'user');
    const preview = firstQuestion ? firstQuestion.content.substring(0, 100) + (firstQuestion.content.length > 100 ? '...' : '') : 'Q&A Thread';
    const expanded = !thread.collapsed ? ' expanded' : '';

    const msgHtml = thread.messages.map(m =>
      `<div class="embedded-thread-msg ${m.role}">${escapeMinimal(m.content)}</div>`
    ).join('');

    return `<div class="embedded-thread${expanded}" data-timestamp="${thread.timestamp}">
      <div class="embedded-thread-toggle">${escapeHtml(preview)}</div>
      <div class="embedded-thread-body">${msgHtml}</div>
    </div>`;
  }).join('');
}

function renderSectionAiZone(heading, threads, aiConfigured) {
  const threadHtml = renderEmbeddedThreads(threads, heading);
  const noApiMsg = !aiConfigured
    ? '<div class="section-ai-setup">Configure your API key in config.json to enable AI assistance</div>'
    : '';

  return `<div class="section-ai-zone" data-heading="${escapeHtml(heading)}">
    <div class="section-embedded-threads">${threadHtml}</div>
    <button class="section-ask-btn"${!aiConfigured ? ' disabled' : ''}>Ask about this section</button>
    <div class="section-ai-panel" style="display:none">
      ${noApiMsg}
      <div class="section-ai-messages"></div>
      <div class="section-ai-input-area">
        <textarea class="section-ai-input" placeholder="Ask about '${escapeHtml(heading)}'..." rows="2"></textarea>
        <button class="btn btn-primary section-ai-send"${!aiConfigured ? ' disabled' : ''}>Send</button>
      </div>
    </div>
  </div>`;
}

export function renderLessonContent(lesson, courseId, aiConfigured) {
  const threads = getThreads(courseId, lesson.id);

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${lesson.content}</div>`, 'text/html');
  const container = doc.body.firstChild;
  const headings = Array.from(container.querySelectorAll('h2'));

  // Build sections: each h2 and everything until the next h2
  const sections = [];
  headings.forEach((h2, i) => {
    const nextH2 = headings[i + 1];
    let sectionHtml = h2.outerHTML;
    let sibling = h2.nextElementSibling;
    while (sibling && sibling !== nextH2) {
      sectionHtml += sibling.outerHTML;
      sibling = sibling.nextElementSibling;
    }
    sections.push({ heading: h2.textContent.trim(), html: sectionHtml });
  });

  // Content before first h2 (if any)
  let preH2Html = '';
  let node = container.firstChild;
  while (node && !(node.tagName === 'H2')) {
    preH2Html += node.outerHTML || node.textContent;
    node = node.nextSibling;
  }

  // Rebuild with AI zones after each section
  let result = preH2Html;
  sections.forEach(section => {
    result += section.html;
    result += renderSectionAiZone(section.heading, threads, aiConfigured);
  });

  return result;
}

export function applyHighlighting(rootEl) {
  rootEl.querySelectorAll('.config-block').forEach(block => {
    block.innerHTML = highlightConfig(block.textContent);
  });
}

export function bindThreadToggles(rootEl) {
  rootEl.querySelectorAll('.embedded-thread-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.closest('.embedded-thread').classList.toggle('expanded');
    });
  });
}
