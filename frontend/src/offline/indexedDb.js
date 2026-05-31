const DB_NAME = 'deutschscene-offline';
const DB_VERSION = 1;
const STORES = ['lessons', 'stories', 'mistakes', 'attempts', 'generatedContent', 'syncQueue'];

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of STORES) {
        if (db.objectStoreNames.contains(storeName)) continue;
        const store = db.createObjectStore(storeName, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        if (storeName !== 'syncQueue') {
          store.createIndex('lessonId', 'lessonId', { unique: false });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, callback) {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = callback(store);
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function saveOffline(storeName, value) {
  assertStore(storeName);
  const now = new Date().toISOString();
  const record = {
    ...value,
    id: value.id || `${storeName}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    updatedAt: value.updatedAt || now
  };
  await withStore(storeName, 'readwrite', store => store.put(record));
  return record;
}

export async function getOffline(storeName, id) {
  assertStore(storeName);
  return withStore(storeName, 'readonly', store => store.get(id));
}

export async function listOffline(storeName) {
  assertStore(storeName);
  return withStore(storeName, 'readonly', store => store.getAll());
}

export async function removeOffline(storeName, id) {
  assertStore(storeName);
  await withStore(storeName, 'readwrite', store => store.delete(id));
}

export async function queueOfflineMutation({ url, method = 'POST', body }) {
  return saveOffline('syncQueue', {
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url,
    method,
    body,
    createdAt: new Date().toISOString()
  });
}

export const cacheLesson = lesson => saveOffline('lessons', {
  ...lesson,
  lessonId: lesson.lessonId || lesson.lesson_id || lesson.id
});

export const cacheStory = story => saveOffline('stories', {
  ...story,
  lessonId: story.lessonId || story.lesson_id || story.based_on_lesson_id
});

export const cacheMistake = mistake => saveOffline('mistakes', {
  ...mistake,
  lessonId: mistake.lessonId || mistake.lesson_id
});

export const cacheAttempt = attempt => saveOffline('attempts', {
  ...attempt,
  lessonId: attempt.lessonId || attempt.lesson_id
});

function assertStore(storeName) {
  if (!STORES.includes(storeName)) {
    throw new Error(`Unknown offline store: ${storeName}`);
  }
}
