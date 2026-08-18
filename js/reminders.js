import { all, remove, save } from "./storage.js";
import { escapeHtml } from "./utils.js";
import { closeModal, confirmDialog, emptyState, formField, getForm, modal, toast } from "./ui.js";

export async function getReminders() {
  return (await all("reminders")).sort((a, b) => Number(a.done) - Number(b.done) || new Date(b.createdAt) - new Date(a.createdAt));
}

export function renderReminders(reminders, limit = null) {
  const list = limit ? reminders.slice(0, limit) : reminders;
  if (!list.length) return emptyState("No reminders yet", "Keep today's small study commitments here.", `<button class="button" data-add-reminder>Add Reminder</button>`);
  return `<div class="stack">${list.map((item) => `
    <article class="reminder ${item.done ? "done" : ""}">
      <input type="checkbox" aria-label="Mark reminder complete" data-toggle-reminder="${item.id}" ${item.done ? "checked" : ""}>
      <span class="reminder-text">${escapeHtml(item.text)}</span>
      <div class="actions"><button class="mini-button" data-edit-reminder="${item.id}">Edit</button><button class="mini-button" data-delete-reminder="${item.id}">Delete</button></div>
    </article>
  `).join("")}</div>`;
}

export async function remindersPage() {
  return `
    <section class="page" data-page="reminders">
      <div class="page-header">
        <div>
          <p class="eyebrow">Daily focus</p>
          <h1>Reminders</h1>
          <p class="muted">Simple reminders only. This stays lightweight on purpose.</p>
        </div>
        <button class="button" data-add-reminder>Add Reminder</button>
      </div>
      ${renderReminders(await getReminders())}
    </section>
  `;
}

export function bindReminderEvents(router) {
  document.addEventListener("click", async (event) => {
    const add = event.target.closest("[data-add-reminder]");
    const edit = event.target.closest("[data-edit-reminder]");
    const del = event.target.closest("[data-delete-reminder]");
    if (add) openReminderForm({}, router);
    if (edit) openReminderForm((await all("reminders")).find((item) => item.id === edit.dataset.editReminder), router);
    if (del) {
      const ok = await confirmDialog({ title: "Delete reminder?", message: "This reminder will be removed." });
      if (ok) {
        await remove("reminders", del.dataset.deleteReminder);
        toast("Reminder deleted");
        router.refresh();
      }
    }
  });
  document.addEventListener("change", async (event) => {
    if (!event.target.matches("[data-toggle-reminder]")) return;
    const reminder = (await all("reminders")).find((item) => item.id === event.target.dataset.toggleReminder);
    await save("reminders", { ...reminder, done: event.target.checked });
    router.refresh();
  });
}

function openReminderForm(reminder = {}, router) {
  modal(reminder.id ? "Edit Reminder" : "Add Reminder", `
    <form id="reminderForm" class="form-grid">
      ${formField({ label: "Reminder", name: "text", value: reminder.text || "", required: true })}
      <div class="actions"><button class="button" type="submit">Save Reminder</button><button class="ghost-button" type="button" data-close-modal>Cancel</button></div>
    </form>
  `);
  document.querySelector("#reminderForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = getForm(event.currentTarget);
    if (!data.text.trim()) return toast("Reminder text is required");
    await save("reminders", { ...reminder, text: data.text.trim(), done: reminder.done || false });
    closeModal();
    toast("Reminder saved");
    router.refresh();
  });
}
