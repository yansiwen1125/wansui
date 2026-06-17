import { EFFECTIVE_START_DATE, LEGACY_USERNAME, createDefaultTasks, normalizeTask } from "./domain.js";

const DB_NAME = "wansui-v1";
const STORE = "state";
const CURRENT_USER_KEY = "wansui:current-user";
const LEGACY_LOGIN_KEY = "wansui:logged-in";

function cacheKey(username = LEGACY_USERNAME) {
  return `records:v1.1:${username || LEGACY_USERNAME}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getValue(key, fallback) {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result ?? fallback);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return fallback;
  }
}

async function setValue(key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(value, key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadCache(username = LEGACY_USERNAME) {
  const records = await getValue(cacheKey(username), null);
  if (records) return records;
  if (username === LEGACY_USERNAME) return getValue("records", []);
  return [];
}

export async function saveCache(username, records) {
  await setValue(cacheKey(username), records);
}

export async function loadUsers() {
  const users = await getValue("users", null);
  if (users?.length) return users;
  return [{ username: LEGACY_USERNAME, createdAt: new Date().toISOString() }];
}

export async function saveUsers(users) {
  await setValue("users", users);
}

export async function ensureLegacyUser() {
  const users = await loadUsers();
  if (!users.some((user) => user.username === LEGACY_USERNAME)) {
    users.push({ username: LEGACY_USERNAME, createdAt: new Date().toISOString() });
    await saveUsers(users);
  }
  const tasks = await loadTasks(LEGACY_USERNAME);
  if (!tasks.length) await saveTasks(LEGACY_USERNAME, createDefaultTasks(EFFECTIVE_START_DATE));
  return users;
}

export async function loadTasks(username) {
  const tasks = await getValue(`tasks:${username}`, []);
  return tasks.map(normalizeTask);
}

export async function saveTasks(username, tasks) {
  await setValue(`tasks:${username}`, tasks.map(normalizeTask));
}

export function currentUsername() {
  return localStorage.getItem(CURRENT_USER_KEY)
    || (localStorage.getItem(LEGACY_LOGIN_KEY) === "true" ? LEGACY_USERNAME : "");
}

export function isLoggedIn() {
  return Boolean(currentUsername());
}

export function setLoggedIn(username = LEGACY_USERNAME) {
  localStorage.setItem(CURRENT_USER_KEY, username);
  localStorage.setItem(LEGACY_LOGIN_KEY, "true");
}

export function logout() {
  localStorage.removeItem(CURRENT_USER_KEY);
  localStorage.removeItem(LEGACY_LOGIN_KEY);
}
