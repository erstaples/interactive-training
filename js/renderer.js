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

function renderEmbeddedThreads(threads, heading) {
  const matching = threads.filter(t => t.anchorHeading === heading);
  if (matching.length === 0) return '';

  return matching.map(thread => {
    const firstQuestion = thread.messages.find(m => m.role === 'user');
    const preview = firstQuestion ? firstQuestion.content.substring(0, 80) + (firstQuestion.content.length > 80 ? '...' : '') : 'Q&A Thread';
    const expanded = !thread.collapsed ? ' expanded' : '';

    const msgHtml = thread.messages.map(m =>
      `<div class="embedded-thread-msg ${m.role}">${escapeHtml(m.content)}</div>`
    ).join('');

    return `<div class="embedded-thread${expanded}" data-timestamp="${thread.timestamp}">
      <div class="embedded-thread-toggle">${escapeHtml(preview)}</div>
      <div class="embedded-thread-body">${msgHtml}</div>
    </div>`;
  }).join('');
}

export function renderLessonContent(lesson, courseId) {
  const threads = getThreads(courseId, lesson.id);

  // Parse content and inject embedded threads after each h2
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${lesson.content}</div>`, 'text/html');
  const container = doc.body.firstChild;
  const headings = container.querySelectorAll('h2');

  headings.forEach(h2 => {
    const threadHtml = renderEmbeddedThreads(threads, h2.textContent.trim());
    if (threadHtml) {
      // Find the next h2 or end of content, insert before it
      let insertBefore = h2.nextElementSibling;
      while (insertBefore && insertBefore.tagName !== 'H2') {
        insertBefore = insertBefore.nextElementSibling;
      }
      const threadFragment = parser.parseFromString(`<div>${threadHtml}</div>`, 'text/html').body.firstChild;
      while (threadFragment.firstChild) {
        if (insertBefore) {
          container.insertBefore(threadFragment.firstChild, insertBefore);
        } else {
          container.appendChild(threadFragment.firstChild);
        }
      }
    }
  });

  return container.innerHTML;
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
