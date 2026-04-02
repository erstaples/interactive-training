import { escapeHtml } from './renderer.js';

export function renderQuiz(ex, lessonId, exIndex) {
  const id = `quiz-${lessonId}-${exIndex}`;
  let html = `<div class="exercise-card quiz" id="${id}">
    <div class="exercise-label">Quiz</div>
    <div class="exercise-prompt">${ex.question}</div>
    <div class="quiz-options">`;
  ex.options.forEach((opt, oi) => {
    html += `<label class="quiz-option" data-index="${oi}">
      <input type="radio" name="${id}" value="${oi}"> ${opt}
    </label>`;
  });
  html += `</div>
    <div class="btn-group">
      <button class="btn btn-primary quiz-check-btn" data-quiz="${id}" data-correct="${ex.correct}" data-lesson="${lessonId}" data-ex="${exIndex}">Check</button>
    </div>
    <div class="feedback" id="${id}-feedback"></div>
    <div class="feedback" id="${id}-explanation" style="display:none;margin-top:0.5rem;background:rgba(122,162,247,0.1);border-color:var(--accent);color:var(--text-secondary)"></div>
  </div>`;
  return html;
}

export function renderConfigEditor(ex, lessonId, exIndex) {
  const id = `editor-${lessonId}-${exIndex}`;
  let html = `<div class="exercise-card config-editor" id="${id}">
    <div class="exercise-label">Config Exercise</div>
    <div class="exercise-prompt">${ex.prompt}</div>
    <textarea class="config-textarea" id="${id}-textarea">${escapeHtml(ex.startingConfig)}</textarea>
    <div class="btn-group">
      <button class="btn btn-primary editor-validate-btn" data-editor="${id}" data-lesson="${lessonId}" data-ex="${exIndex}">Validate</button>
      <button class="btn btn-secondary editor-solution-btn" data-editor="${id}" data-ex="${exIndex}" data-lesson="${lessonId}">Show Solution</button>
    </div>
    <div class="feedback" id="${id}-feedback"></div>
    <div class="solution" id="${id}-solution">
      <div class="solution-header">Solution</div>
      <div class="config-block">${escapeHtml(ex.solution)}</div>
      <div class="solution-notes">${ex.solutionNotes || ''}</div>
    </div>
  </div>`;
  return html;
}

export function bindExerciseHandlers(lessonId, exercises, onComplete) {
  // Quiz handlers
  document.querySelectorAll('.quiz-check-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const quizId = btn.dataset.quiz;
      const correct = parseInt(btn.dataset.correct);
      const exIndex = parseInt(btn.dataset.ex);
      const card = document.getElementById(quizId);
      const selected = card.querySelector('input[type="radio"]:checked');
      const feedback = document.getElementById(`${quizId}-feedback`);
      const explanation = document.getElementById(`${quizId}-explanation`);
      const ex = exercises[exIndex];

      if (!selected) {
        feedback.textContent = 'Select an option first.';
        feedback.className = 'feedback visible fail';
        return;
      }

      const value = parseInt(selected.value);
      card.querySelectorAll('.quiz-option').forEach(opt => {
        opt.classList.remove('selected', 'correct', 'incorrect');
        const idx = parseInt(opt.dataset.index);
        if (idx === correct) opt.classList.add('correct');
        else if (idx === value) opt.classList.add('incorrect');
      });

      if (value === correct) {
        feedback.textContent = 'Correct!';
        feedback.className = 'feedback visible pass';
        onComplete();
      } else {
        feedback.textContent = 'Not quite. Try again!';
        feedback.className = 'feedback visible fail';
      }

      if (ex.explanation) {
        explanation.innerHTML = ex.explanation;
        explanation.style.display = 'block';
        explanation.classList.add('visible');
      }
    });
  });

  // Config editor handlers
  document.querySelectorAll('.editor-validate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const editorId = btn.dataset.editor;
      const exIndex = parseInt(btn.dataset.ex);
      const ex = exercises[exIndex];
      const textarea = document.getElementById(`${editorId}-textarea`);
      const feedback = document.getElementById(`${editorId}-feedback`);
      const value = textarea.value;

      let allPass = true;
      let failMessage = '';
      for (const v of ex.validators) {
        const regex = new RegExp(v.regex, v.flags || '');
        if (!regex.test(value)) {
          allPass = false;
          failMessage = v.hint || v.message;
          break;
        }
      }

      if (allPass) {
        feedback.textContent = ex.successMessage || 'Correct! Your config is valid.';
        feedback.className = 'feedback visible pass';
        onComplete();
      } else {
        feedback.textContent = failMessage;
        feedback.className = 'feedback visible fail';
      }
    });
  });

  // Solution toggles
  document.querySelectorAll('.editor-solution-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const editorId = btn.dataset.editor;
      const solution = document.getElementById(`${editorId}-solution`);
      const isVisible = solution.classList.contains('visible');
      solution.classList.toggle('visible');
      btn.textContent = isVisible ? 'Show Solution' : 'Hide Solution';

      if (!isVisible) {
        import('./renderer.js').then(({ highlightConfig }) => {
          solution.querySelectorAll('.config-block').forEach(block => {
            block.innerHTML = highlightConfig(block.textContent);
          });
        });
      }
    });
  });

  // Tab key in textareas
  document.querySelectorAll('.config-textarea').forEach(ta => {
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + 2;
      }
    });
  });
}
