const DB_NAME = "wansui-v1";
const STORE = "state";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadCache() {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get("records");
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

export async function saveCache(records) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(records, "records");
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

export function isLoggedIn() {
  return localStorage.getItem("wansui:logged-in") === "true";
}

export function setLoggedIn() {
  localStorage.setItem("wansui:logged-in", "true");
}
