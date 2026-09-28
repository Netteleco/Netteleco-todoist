// Small promise-based IndexedDB helper for task attachments.
// Task metadata (id, name, type, size, createdAt) lives in app.js's `state`
// (localStorage), while the actual binary Blob content lives here in
// IndexedDB, keyed by the same attachment id.

const ATTACHMENTS_DB_NAME = "todo-attachments-v1";
const ATTACHMENTS_STORE = "files";

let _attachmentsDbPromise = null;

function openAttachmentsDb() {
  if (_attachmentsDbPromise) return _attachmentsDbPromise;
  _attachmentsDbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB no disponible"));
      return;
    }
    const request = indexedDB.open(ATTACHMENTS_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ATTACHMENTS_STORE)) {
        const store = db.createObjectStore(ATTACHMENTS_STORE, { keyPath: "id" });
        store.createIndex("taskId", "taskId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return _attachmentsDbPromise;
}

function putAttachment(id, taskId, name, type, blob) {
  return openAttachmentsDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENTS_STORE, "readwrite");
      const store = tx.objectStore(ATTACHMENTS_STORE);
      store.put({ id, taskId, name, type, blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  });
}

function getAttachment(id) {
  return openAttachmentsDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENTS_STORE, "readonly");
      const store = tx.objectStore(ATTACHMENTS_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

function deleteAttachment(id) {
  return openAttachmentsDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENTS_STORE, "readwrite");
      const store = tx.objectStore(ATTACHMENTS_STORE);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  });
}

function deleteAttachmentsForTask(taskId) {
  return openAttachmentsDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENTS_STORE, "readwrite");
      const store = tx.objectStore(ATTACHMENTS_STORE);
      const index = store.index("taskId");
      const req = index.openCursor(taskId);
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  });
}
