import { all, remove, save } from "./storage.js";
import { byTime, DAYS, escapeHtml, parseScheduleText, todayName } from "./utils.js";
import { closeModal, confirmDialog, emptyState, formField, getForm, modal, toast } from "./ui.js";

export async function getTimetable() {
  return (await all("timetable")).sort(byTime);
}

export function renderToday(entries) {
  const day = todayName();
  const todayEntries = entries.filter((entry) => entry.day === day).sort(byTime);
  if (!todayEntries.length) {
    return emptyState("No classes scheduled today", "Add your weekly timetable and today's classes will appear here.", `<a class="button" href="#/timetable">Add Timetable</a>`);
  }
  const remainingEntries = todayEntries.filter((entry) => isCurrentClass(entry) || isFutureClass(entry));
  if (!remainingEntries.length) {
    return emptyState("No more classes today", "Your remaining schedule is clear. The full week is still available in Timetable.", `<a class="button" href="#/timetable">View Weekly Timetable</a>`);
  }
  return `<div class="timeline">${remainingEntries.map(renderClassItem).join("")}</div>`;
}

export function renderClassItem(entry, editable = false) {
  const current = isCurrentClass(entry) ? " current" : "";
  return `
    <article class="class-item${current}">
      <div class="time">${escapeHtml(entry.startTime)}<br>${escapeHtml(entry.endTime)}</div>
      <div>
        <h3>${escapeHtml(entry.subject)}</h3>
        <p class="muted">${[entry.room, entry.teacher, entry.notes].filter(Boolean).map(escapeHtml).join(" • ") || "No extra details"}</p>
      </div>
      ${editable ? `<div class="actions"><button class="mini-button" data-edit-entry="${entry.id}">Edit</button><button class="mini-button" data-delete-entry="${entry.id}">Delete</button></div>` : "<span></span>"}
    </article>
  `;
}

function isCurrentClass(entry) {
  const today = todayName();
  if (entry.day !== today || !entry.startTime || !entry.endTime) return false;
  const nowDate = new Date();
  const current = nowDate.getHours() * 60 + nowDate.getMinutes();
  return current >= minutesFromTime(entry.startTime) && current <= minutesFromTime(entry.endTime);
}

function isFutureClass(entry) {
  if (entry.day !== todayName() || !entry.startTime) return false;
  const nowDate = new Date();
  const current = nowDate.getHours() * 60 + nowDate.getMinutes();
  return minutesFromTime(entry.startTime) > current;
}

function minutesFromTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export async function timetablePage() {
  const entries = await getTimetable();
  return `
    <section class="page" data-page="timetable">
      <div class="page-header">
        <div>
          <p class="eyebrow">Weekly source of truth</p>
          <h1>Timetable</h1>
          <p class="muted">Manage the full week here. The dashboard shows only today.</p>
        </div>
        <div class="actions">
          <button class="ghost-button" data-import-schedule>Paste Schedule</button>
          <button class="button" data-add-entry>Add Class</button>
        </div>
      </div>
      <div class="tabs">${DAYS.map((day) => `<button class="tab ${day === todayName() ? "active" : ""}" data-day-tab="${day}">${day}</button>`).join("")}</div>
      <div id="dayPanel">${renderDay(entries, todayName())}</div>
    </section>
  `;
}

export function renderDay(entries, day) {
  const dayEntries = entries.filter((entry) => entry.day === day).sort(byTime);
  return `
    <section class="card">
      <div class="split">
        <div><h2>${escapeHtml(day)}</h2><p class="muted">${dayEntries.length} class${dayEntries.length === 1 ? "" : "es"}</p></div>
        <button class="button" data-add-entry-day="${escapeHtml(day)}">Add Class</button>
      </div>
      <div class="section">${dayEntries.length ? `<div class="timeline">${dayEntries.map((entry) => renderClassItem(entry, true)).join("")}</div>` : emptyState(`No classes for ${day}`, "Use Add Class to build this day.")}</div>
    </section>
  `;
}

export function bindTimetablePage(router) {
  const page = document.querySelector("[data-page='timetable']");
  if (!page) return;
  let currentDay = todayName();
  page.addEventListener("click", async (event) => {
    const dayTab = event.target.closest("[data-day-tab]");
    const add = event.target.closest("[data-add-entry], [data-add-entry-day]");
    const edit = event.target.closest("[data-edit-entry]");
    const del = event.target.closest("[data-delete-entry]");
    const importer = event.target.closest("[data-import-schedule]");
    if (dayTab) {
      currentDay = dayTab.dataset.dayTab;
      page.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === dayTab));
      page.querySelector("#dayPanel").innerHTML = renderDay(await getTimetable(), currentDay);
    }
    if (add) openEntryForm({ day: add.dataset.addEntryDay || currentDay }, router);
    if (edit) openEntryForm((await getTimetable()).find((entry) => entry.id === edit.dataset.editEntry), router);
    if (del) {
      const ok = await confirmDialog({ title: "Delete class?", message: "This timetable entry will be removed from your weekly schedule." });
      if (ok) {
        await remove("timetable", del.dataset.deleteEntry);
        toast("Timetable updated");
        router.refresh();
      }
    }
    if (importer) openImportDialog(router);
  });
}

function openEntryForm(entry = {}, router) {
  modal(entry.id ? "Edit Class" : "Add Class", `
    <form id="entryForm" class="form-grid">
      ${formField({ label: "Day", name: "day", value: entry.day || todayName(), options: DAYS })}
      <div class="form-grid two">
        ${formField({ label: "Start time", name: "startTime", value: entry.startTime || "", type: "time", required: true })}
        ${formField({ label: "End time", name: "endTime", value: entry.endTime || "", type: "time", required: true })}
      </div>
      ${formField({ label: "Subject", name: "subject", value: entry.subject || "", required: true })}
      <div class="form-grid two">
        ${formField({ label: "Room", name: "room", value: entry.room || "" })}
        ${formField({ label: "Teacher", name: "teacher", value: entry.teacher || "" })}
      </div>
      ${formField({ label: "Notes", name: "notes", value: entry.notes || "", rows: 3 })}
      <div class="actions"><button class="button" type="submit">Save Class</button><button class="ghost-button" type="button" data-close-modal>Cancel</button></div>
    </form>
  `);
  document.querySelector("#entryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = getForm(event.currentTarget);
    if (data.endTime <= data.startTime) {
      toast("End time must be after start time");
      return;
    }
    await save("timetable", { ...entry, ...data });
    closeModal();
    toast("Timetable saved");
    router.refresh();
  });
}

function openImportDialog(router) {
  modal("Paste Schedule", `
    <form id="importForm" class="form-grid">
      ${formField({ label: "Schedule text", name: "schedule", rows: 9, placeholder: "Monday:\n9-10 DBMS\n10-11 Python" })}
      <p class="muted">Entries are parsed locally and added to your weekly timetable. Review them afterward before relying on the schedule.</p>
      <div class="actions"><button class="button" type="submit">Import Parsed Classes</button><button class="ghost-button" type="button" data-close-modal>Cancel</button></div>
    </form>
  `);
  document.querySelector("#importForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const entries = parseScheduleText(getForm(event.currentTarget).schedule);
    if (!entries.length) {
      toast("No recognizable timetable entries found");
      return;
    }
    for (const entry of entries) await save("timetable", entry);
    closeModal();
    toast(`${entries.length} class${entries.length === 1 ? "" : "es"} imported`);
    router.refresh();
  });
}
