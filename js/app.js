import { getProgress, setLessonComplete, resetCourse } from './store.js';
import { renderLessonContent, applyHighlighting, bindThreadToggles } from './renderer.js';
import { renderQuiz, renderConfigEditor, bindExerciseHandlers } from './exercises.js';
import { initWidget, setContext } from './ai-widget.js';

let appConfig = null;
let courses = [];
let currentCourse = null;
let currentLessonId = null;

async function init() {
  // Load config
  try {
    const res = await fetch('config.json');
    appConfig = await res.json();
  } catch {
    appConfig = { provider: 'anthropic', apiKey: '', baseUrl: '', model: '' };
  }

  // Load course manifest
  try {
    const res = await fetch('content/index.json');
    const manifest = await res.json();
    const coursePromises = manifest.map(async filename => {
      const r = await fetch(`content/${filename}`);
      return r.json();
    });
    courses = await Promise.all(coursePromises);
  } catch (err) {
    document.getElementById('main-content').innerHTML =
      `<p style="padding:2rem;color:var(--error)">Failed to load courses: ${err.message}</p>`;
    return;
  }

  // Init AI widget
  await initWidget(appConfig);

  // Bind global UI
  document.getElementById('reset-btn').addEventListener('click', handleReset);
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Route: single course → load directly, multiple → show picker
  if (courses.length === 1) {
    loadCourse(courses[0]);
  } else {
    showCoursePicker();
  }
}

function showCoursePicker() {
  document.getElementById('sidebar').innerHTML = '';
  document.getElementById('reset-btn').style.display = 'none';
  document.getElementById('back-btn').style.display = 'none';
  document.getElementById('topbar-title').textContent = 'Interactive Training';
  document.getElementById('progress-text').textContent = '';
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('ai-widget').style.display = 'none';

  const main = document.getElementById('main-content');
  main.innerHTML = `<h1 style="padding-bottom:1rem">Select a Course</h1>
    <div class="course-grid">${courses.map(c =>
      `<div class="course-card" data-course="${c.id}">
        <div class="course-card-title">${c.title}</div>
        <div class="course-card-desc">${c.description}</div>
      </div>`
    ).join('')}</div>`;

  main.querySelectorAll('.course-card').forEach(card => {
    card.addEventListener('click', () => {
      const course = courses.find(c => c.id === card.dataset.course);
      if (course) loadCourse(course);
    });
  });
}

function loadCourse(course) {
  currentCourse = course;
  document.getElementById('topbar-title').textContent = course.title;
  document.getElementById('reset-btn').style.display = 'block';

  if (courses.length > 1) {
    const backBtn = document.getElementById('back-btn');
    backBtn.style.display = 'inline';
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      currentCourse = null;
      currentLessonId = null;
      showCoursePicker();
    });
  }

  // Get all lessons flat for progress tracking
  const allLessons = course.modules.flatMap(m => m.lessons);
  currentLessonId = allLessons[0].id;

  renderSidebar();
  renderLesson(currentLessonId);
  updateProgressBar();
}

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  const progress = getProgress(currentCourse.id);

  let html = '';
  currentCourse.modules.forEach(mod => {
    html += `<div class="sidebar-module">
      <div class="sidebar-module-title">Module ${mod.number} — ${mod.title}</div>`;
    mod.lessons.forEach(lesson => {
      const isActive = lesson.id === currentLessonId ? ' active' : '';
      const isComplete = progress[lesson.id] ? ' completed' : '';
      const checkmark = progress[lesson.id] ? '&#10003;' : '';
      html += `<div class="sidebar-lesson${isActive}" data-lesson="${lesson.id}">
        <span class="sidebar-lesson-check${isComplete}">${checkmark}</span>
        <span>${lesson.title}</span>
      </div>`;
    });
    html += '</div>';
  });

  sidebar.innerHTML = html;
  sidebar.querySelectorAll('.sidebar-lesson').forEach(el => {
    el.addEventListener('click', () => {
      navigateTo(el.dataset.lesson);
      sidebar.classList.remove('open');
    });
  });
}

function findLessonAndModule(lessonId) {
  for (const mod of currentCourse.modules) {
    const lesson = mod.lessons.find(l => l.id === lessonId);
    if (lesson) return { lesson, module: mod };
  }
  return null;
}

function renderLesson(lessonId) {
  const found = findLessonAndModule(lessonId);
  if (!found) return;

  const { lesson, module } = found;
  currentLessonId = lessonId;

  const main = document.getElementById('main-content');
  const progress = getProgress(currentCourse.id);

  let html = `<h1>${lesson.title}</h1>`;
  html += renderLessonContent(lesson, currentCourse.id);

  // Exercises
  lesson.exercises.forEach((ex, i) => {
    if (ex.type === 'quiz') {
      html += renderQuiz(ex, lessonId, i);
    } else if (ex.type === 'config-editor') {
      html += renderConfigEditor(ex, lessonId, i);
    }
  });

  // Mark as read (lessons with no exercises)
  if (lesson.exercises.length === 0 && !progress[lessonId]) {
    html += `<button class="btn btn-secondary mark-read-btn" data-lesson="${lessonId}">Mark as Read</button>`;
  }

  main.innerHTML = html;
  main.scrollTop = 0;

  // Post-render setup
  applyHighlighting(main);
  bindThreadToggles(main);

  // Bind mark-as-read
  const markBtn = main.querySelector('.mark-read-btn');
  if (markBtn) {
    markBtn.addEventListener('click', () => {
      setLessonComplete(currentCourse.id, lessonId);
      renderSidebar();
      updateProgressBar();
      markBtn.remove();
    });
  }

  // Bind exercises
  const onExerciseComplete = () => {
    setLessonComplete(currentCourse.id, lessonId);
    renderSidebar();
    updateProgressBar();
  };
  bindExerciseHandlers(lessonId, lesson.exercises, onExerciseComplete);

  // Set AI widget context
  setContext(currentCourse, module, lesson);

  renderSidebar();
}

function navigateTo(lessonId) {
  renderLesson(lessonId);
}

function updateProgressBar() {
  const allLessons = currentCourse.modules.flatMap(m => m.lessons);
  const progress = getProgress(currentCourse.id);
  const total = allLessons.length;
  const done = allLessons.filter(l => progress[l.id]).length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = `${done}/${total}`;
}

function handleReset() {
  if (!confirm('Reset all progress? This cannot be undone.')) return;
  resetCourse(currentCourse.id);
  renderSidebar();
  renderLesson(currentLessonId);
  updateProgressBar();
}

// Boot
init();
