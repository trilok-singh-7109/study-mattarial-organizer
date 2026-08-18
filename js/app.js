import { clearAll, getState, importState, openDb } from "./storage.js";
import { bytes, downloadBlob, escapeHtml, formatDate, greeting, todayName } from "./utils.js";
import { setActiveNav, toast, confirmDialog, modal } from "./ui.js";
import { bindTimetablePage, getTimetable, renderToday, timetablePage } from "./timetable.js";
import { bindSubjectEvents, getSubjects, renderSubjects, subjectPage, subjectsPage } from "./subjects.js";
import { bindMaterialEvents, containerPage } from "./materials.js";
import { bindReminderEvents, getReminders, remindersPage, renderReminders } from "./reminders.js";

const view = document.querySelector("#view");
const searchInput = document.querySelector("#globalSearch");

const router = {
  async render() {
    try {
      await openDb();
      const path = normalizePath();
      setActiveNav(path);
      view.innerHTML = await route(path);
      view.focus({ preventScroll: true });
      bindTimetablePage(router);
    } catch (error) {
      view.innerHTML = `<section class="page"><div class="card"><h1>Storage unavailable</h1><p class="muted">${escapeHtml(error.message || "The app could not open local storage.")}</p></div></section>`;
    }
  },
  refresh() {
    return this.render();
  }
};

function normalizePath() {
  return (location.hash.replace(/^#/, "") || "/").split("?")[0];
}

async function route(path) {
  if (path === "/") return dashboardPage();
  if (path === "/timetable") return timetablePage();
  if (path === "/subjects") return subjectsPage();
  if (path.startsWith("/subjects/")) return subjectPage(path.split("/")[2]);
  if (path.startsWith("/containers/")) return containerPage(path.split("/")[2]);
  if (path === "/reminders") return remindersPage();
  if (path === "/settings") return settingsPage();
  if (path === "/search") return searchPage(searchInput.value);
  return dashboardPage();
}

async function dashboardPage() {
  const [entries, subjects, reminders, state] = await Promise.all([getTimetable(), getSubjects(), getReminders(), getState()]);
  const materialCount = state.materials.length;
  return `
    <section class="page" data-page="dashboard">
      <div class="hero-panel">
        <div>
          <p class="eyebrow">${escapeHtml(formatDate())}</p>
          <h1>${escapeHtml(greeting())}</h1>
          <p class="muted">Today's Study centers on ${escapeHtml(todayName())}: classes first, subjects next, reminders close at hand.</p>
        </div>
        <div class="card">
          <strong>${subjects.length}</strong> subjects<br>
          <span class="muted">${materialCount} materials stored locally</span>
        </div>
      </div>

      <section class="section">
        <div class="split"><h2>Today's Classes</h2><a class="ghost-button" href="#/timetable">View Weekly Timetable</a></div>
        ${renderToday(entries)}
      </section>

      <section class="section">
        <div class="split"><h2>My Subjects</h2><button class="button" data-add-subject>Add Subject</button></div>
        ${renderSubjects(subjects, true)}
      </section>

      <section class="section grid two">
        <div class="card">
          <div class="split"><h2>Quick Access</h2><a class="ghost-button" href="#/subjects">All Subjects</a></div>
          <p class="muted">Open a subject, create containers, then add files or notes. Everything stays in this browser.</p>
        </div>
        <div class="card">
          <div class="split"><h2>Today's Reminders</h2><button class="button" data-add-reminder>Add Reminder</button></div>
          ${renderReminders(reminders, 4)}
        </div>
      </section>
    </section>
  `;
}

async function searchPage(query) {
  const q = (query || "").trim().toLowerCase();
  const state = await getState();
  const subjects = state.subjects.filter((item) => item.name.toLowerCase().includes(q));
  const containers = state.containers.filter((item) => item.name.toLowerCase().includes(q));
  const materials = state.materials.filter((item) => `${item.title || ""} ${item.name || ""} ${item.content || ""}`.toLowerCase().includes(q));
  return `
    <section class="page" data-page="search">
      <div class="page-header"><div><p class="eyebrow">Search</p><h1>${escapeHtml(q ? `Results for "${q}"` : "Search")}</h1></div></div>
      ${!q ? `<div class="empty-state"><div><h3>Start typing above</h3><p class="muted">Search subjects, containers, notes, and file names.</p></div></div>` : `
      <div class="stack">
        ${searchGroup("Subjects", subjects.map((item) => ({ label: item.name, meta: "Subject", href: `#/subjects/${item.id}` })))}
        ${searchGroup("Containers", containers.map((item) => ({ label: item.name, meta: "Container", href: `#/containers/${item.id}` })))}
        ${searchGroup("Materials", materials.map((item) => ({ label: item.title || item.name, meta: item.kind === "note" ? "Note" : item.mimeType, href: `#/containers/${item.containerId}` })))}
      </div>`}
    </section>
  `;
}

function searchGroup(title, rows) {
  return `<section class="card"><h2>${escapeHtml(title)}</h2>${rows.length ? rows.map((row) => `<a class="material-row" href="${row.href}"><div class="file-icon">GO</div><div><h3>${escapeHtml(row.label)}</h3><p class="muted">${escapeHtml(row.meta || "")}</p></div><span>→</span></a>`).join("") : `<p class="muted">No matches.</p>`}</section>`;
}

async function settingsPage() {
  const state = await getState();
  const fileBytes = state.materials.reduce((sum, item) => sum + (item.size || 0), 0);
  return `
    <section class="page" data-page="settings">
      <div class="page-header">
        <div><p class="eyebrow">Local-first controls</p><h1>Settings</h1><p class="muted">Data is stored locally on this device and browser profile.</p></div>
      </div>
      <div class="grid two">
        <section class="card stack">
          <h2>Theme</h2>
          <div class="actions">
            <button class="ghost-button" data-theme="light">Light</button>
            <button class="ghost-button" data-theme="dark">Dark</button>
            <button class="ghost-button" data-theme="system">System</button>
          </div>
        </section>
        <section class="card stack">
          <h2>Storage Information</h2>
          <p class="muted">${state.subjects.length} subjects, ${state.containers.length} containers, ${state.materials.length} materials, ${state.reminders.length} reminders.</p>
          <p class="muted">Uploaded file payloads stored: ${bytes(fileBytes)}.</p>
        </section>
        <section class="card stack">
          <h2>Backup and Restore</h2>
          <p class="muted">Export creates a JSON backup with app data and file blobs where your browser supports structured IndexedDB blob export.</p>
          <div class="actions">
            <button class="button" data-export-data>Export Data</button>
            <button class="ghost-button" data-import-data>Import Data</button>
            <input id="backupInput" class="sr-only" type="file" accept="application/json">
          </div>
        </section>
        <section class="card stack">
          <h2>Clear Application Data</h2>
          <p class="muted">This removes timetable, subjects, containers, materials, notes, reminders, and locally stored files.</p>
          <button class="danger-button" data-clear-data>Clear All Data</button>
        </section>
      </div>
    </section>
  `;
}

function bindGlobalEvents() {
  document.querySelector("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
    toast(`${next[0].toUpperCase() + next.slice(1)} theme enabled`);
  });

  searchInput.addEventListener("input", () => {
    if (searchInput.value.trim()) location.hash = "#/search";
    if (normalizePath() === "/search") router.refresh();
  });

  document.addEventListener("click", async (event) => {
    const theme = event.target.closest("[data-theme]");
    const exportData = event.target.closest("[data-export-data]");
    const importData = event.target.closest("[data-import-data]");
    const clearData = event.target.closest("[data-clear-data]");
    if (theme) {
      setTheme(theme.dataset.theme);
      toast("Theme preference saved");
    }
    if (exportData) await exportBackup();
    if (importData) document.querySelector("#backupInput")?.click();
    if (clearData) await clearDataFlow();
  });

  document.addEventListener("change", async (event) => {
    if (!event.target.matches("#backupInput")) return;
    await importBackup(event.target.files[0]);
    event.target.value = "";
  });
}

function setTheme(value) {
  localStorage.setItem("study-theme", value);
  const resolved = value === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : value;
  document.documentElement.dataset.theme = resolved;
}

async function exportBackup() {
  const data = await getState();
  const materials = await Promise.all(data.materials.map(serializeMaterial));
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...data, materials }, null, 2)], { type: "application/json" });
  downloadBlob(blob, `study-organizer-backup-${new Date().toISOString().slice(0, 10)}.json`);
  toast("Backup exported");
}

async function importBackup(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (Array.isArray(data.materials)) {
      data.materials = await Promise.all(data.materials.map(deserializeMaterial));
    }
    await importState(data);
    toast("Backup imported");
    router.refresh();
  } catch {
    toast("Backup file could not be imported");
  }
}

async function serializeMaterial(material) {
  if (!material.blob) return material;
  return {
    ...material,
    blob: undefined,
    blobBackup: {
      dataUrl: await blobToDataUrl(material.blob),
      type: material.blob.type || material.mimeType || "application/octet-stream",
      size: material.blob.size || material.size || 0
    }
  };
}

async function deserializeMaterial(material) {
  if (!material.blobBackup?.dataUrl) return material;
  return {
    ...material,
    blob: dataUrlToBlob(material.blobBackup.dataUrl, material.blobBackup.type),
    blobBackup: undefined
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl, fallbackType) {
  const [header, data] = dataUrl.split(",");
  const type = header.match(/data:(.*?);base64/)?.[1] || fallbackType || "application/octet-stream";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function clearDataFlow() {
  modal("Confirm Clear Data", `
    <p class="muted">Type DELETE to permanently clear all local organizer data in this browser.</p>
    <form id="clearForm" class="form-grid">
      <input name="confirm" autocomplete="off">
      <div class="actions"><button class="danger-button" type="submit">Clear Everything</button><button class="ghost-button" type="button" data-close-modal>Cancel</button></div>
    </form>
  `);
  document.querySelector("#clearForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (new FormData(event.currentTarget).get("confirm") !== "DELETE") return toast("Type DELETE to confirm");
    const ok = await confirmDialog({ title: "Clear all data?", message: "This final confirmation helps prevent accidental deletion.", confirmText: "Clear Data" });
    if (!ok) return;
    await clearAll();
    toast("Application data cleared");
    location.hash = "#/";
    router.refresh();
  });
}

setTheme(localStorage.getItem("study-theme") || "system");
bindGlobalEvents();
bindSubjectEvents(router);
bindMaterialEvents(router);
bindReminderEvents(router);
window.addEventListener("hashchange", () => router.render());
router.render();
