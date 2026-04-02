const STORE_PREFIX = 'training-';

function getStore(courseId) {
  try {
    return JSON.parse(localStorage.getItem(STORE_PREFIX + courseId)) || { progress: {}, threads: {} };
  } catch {
    return { progress: {}, threads: {} };
  }
}

function setStore(courseId, data) {
  localStorage.setItem(STORE_PREFIX + courseId, JSON.stringify(data));
}

export function getProgress(courseId) {
  return getStore(courseId).progress;
}

export function setLessonComplete(courseId, lessonId) {
  const store = getStore(courseId);
  store.progress[lessonId] = true;
  setStore(courseId, store);
}

export function getThreads(courseId, lessonId) {
  const store = getStore(courseId);
  return (store.threads && store.threads[lessonId]) || [];
}

export function saveThread(courseId, lessonId, thread) {
  const store = getStore(courseId);
  if (!store.threads) store.threads = {};
  if (!store.threads[lessonId]) store.threads[lessonId] = [];

  const existing = store.threads[lessonId].findIndex(
    t => t.anchorHeading === thread.anchorHeading && t.timestamp === thread.timestamp
  );
  if (existing >= 0) {
    store.threads[lessonId][existing] = thread;
  } else {
    store.threads[lessonId].push(thread);
  }
  setStore(courseId, store);
}

export function resetCourse(courseId) {
  localStorage.removeItem(STORE_PREFIX + courseId);
}
