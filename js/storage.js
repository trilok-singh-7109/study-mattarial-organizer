import { now, uid } from "./utils.js";

const DB_NAME = "study-organizer-db";
const DB_VERSION = 1;
const STORES = ["timetable", "subjects", "containers", "materials", "reminders"];

let dbPromise;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          const objectStore = db.createObjectStore(store, { keyPath: "id" });
          objectStore.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function withStore(name, mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const store = tx.objectStore(name);
    const result = callback(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function all(name) {
  return withStore(name, "readonly", (store) => promisify(store.getAll()));
}

export async function get(name, id) {
  return withStore(name, "readonly", (store) => promisify(store.get(id)));
}

export async function save(name, item) {
  const timestamp = now();
  const value = {
    ...item,
    id: item.id || uid(name.slice(0, -1)),
    createdAt: item.createdAt || timestamp,
    updatedAt: timestamp
  };
  await withStore(name, "readwrite", (store) => store.put(value));
  return value;
}

export async function remove(name, id) {
  await withStore(name, "readwrite", (store) => store.delete(id));
}

export async function clearStore(name) {
  await withStore(name, "readwrite", (store) => store.clear());
}

export async function clearAll() {
  for (const store of STORES) await clearStore(store);
}

export async function getState() {
  const [timetable, subjects, containers, materials, reminders] = await Promise.all(STORES.map(all));
  return { timetable, subjects, containers, materials, reminders };
}

export async function importState(data) {
  if (!data || typeof data !== "object") throw new Error("Backup file is not valid.");
  for (const store of STORES) {
    await clearStore(store);
    const items = Array.isArray(data[store]) ? data[store] : [];
    for (const item of items) await save(store, item);
  }
}

export { STORES };
