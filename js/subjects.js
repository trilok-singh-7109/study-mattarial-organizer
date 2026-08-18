import { all, remove, save } from "./storage.js";
import { byCreated, escapeHtml } from "./utils.js";
import { closeModal, confirmDialog, emptyState, formField, getForm, modal, toast } from "./ui.js";

const DEFAULT_CONTAINERS = ["Handouts", "Notes", "PPTs", "Assignments"];
const COLORS = ["#246b5b", "#5b5fc7", "#a8551b", "#9f3a55", "#4f6f2f", "#7c3aed"];

export async function getSubjects() {
  return (await all("subjects")).sort(byCreated);
}

export async function subjectsPage() {
  const subjects = await getSubjects();
  return `
    <section class="page" data-page="subjects">
      <div class="page-header">
        <div>
          <p class="eyebrow">Your study spaces</p>
          <h1>Subjects</h1>
          <p class="muted">Create a subject for every course and organize materials inside it.</p>
        </div>
        <button class="button" data-add-subject>Add Subject</button>
      </div>
      ${renderSubjects(subjects)}
    </section>
  `;
}

export function renderSubjects(subjects, compact = false) {
  if (!subjects.length) {
    return emptyState("No subjects yet", "Start organizing your studies by adding your first subject.", `<button class="button" data-add-subject>Add Subject</button>`);
  }
  return `<div class="grid cards">${subjects.map((subject) => `
    <article class="card interactive" data-open-subject="${subject.id}" style="--subject-color:${escapeHtml(subject.color || COLORS[0])}">
      <div class="split">
        <span class="subject-accent"></span>
        ${compact ? "" : `<div class="actions"><button class="mini-button" data-edit-subject="${subject.id}">Edit</button><button class="mini-button" data-delete-subject="${subject.id}">Delete</button></div>`}
      </div>
      <h3>${escapeHtml(subject.name)}</h3>
      <p class="muted">${escapeHtml(subject.description || "Study materials and notes")}</p>
      <p class="stat" data-subject-count="${subject.id}">Open workspace</p>
    </article>
  `).join("")}</div>`;
}

export async function subjectPage(subjectId) {
  const subject = (await getSubjects()).find((item) => item.id === subjectId);
  if (!subject) return notFound("Subject not found");
  const containers = (await all("containers")).filter((item) => item.subjectId === subjectId).sort(byCreated);
  const materials = await all("materials");
  return `
    <section class="page" data-page="subject" data-subject-id="${subject.id}">
      <div class="page-header">
        <div>
          <a class="ghost-button" href="#/subjects">Back to Subjects</a>
          <p class="eyebrow section">Subject workspace</p>
          <h1>${escapeHtml(subject.name)}</h1>
          <p class="muted">${escapeHtml(subject.description || "Containers keep each kind of material in its place.")}</p>
        </div>
        <div class="actions"><button class="ghost-button" data-edit-subject="${subject.id}">Edit Subject</button><button class="button" data-add-container>Add Container</button></div>
      </div>
      <label class="search-box"><span class="sr-only">Search this subject</span><input data-subject-search type="search" placeholder="Search this subject..."></label>
      <section class="section" id="containerList">${renderContainers(containers, materials)}</section>
    </section>
  `;
}

export function renderContainers(containers, materials) {
  if (!containers.length) {
    return emptyState("No containers yet", "Create folders like Notes, Handouts, Assignments, or any custom unit.", `<button class="button" data-add-container>Add Container</button>`);
  }
  return `<div class="grid cards">${containers.map((container) => {
    const count = materials.filter((material) => material.containerId === container.id).length;
    return `
      <article class="card interactive" data-open-container="${container.id}" style="--subject-color:${escapeHtml(container.color || COLORS[1])}">
        <div class="split">
          <span class="subject-accent"></span>
          <div class="actions"><button class="mini-button" data-edit-container="${container.id}">Edit</button><button class="mini-button" data-delete-container="${container.id}">Delete</button></div>
        </div>
        <h3>${escapeHtml(container.name)}</h3>
        <p class="muted">${escapeHtml(container.description || "Material folder")}</p>
        <p class="stat">${count} material${count === 1 ? "" : "s"}</p>
      </article>
    `;
  }).join("")}</div>`;
}

export function bindSubjectEvents(router) {
  document.addEventListener("click", async (event) => {
    const addSubject = event.target.closest("[data-add-subject]");
    const editSubject = event.target.closest("[data-edit-subject]");
    const deleteSubject = event.target.closest("[data-delete-subject]");
    const openSubject = event.target.closest("[data-open-subject]");
    const addContainer = event.target.closest("[data-add-container]");
    const editContainer = event.target.closest("[data-edit-container]");
    const deleteContainer = event.target.closest("[data-delete-container]");
    const openContainer = event.target.closest("[data-open-container]");
    if (addSubject) openSubjectForm({}, router);
    if (editSubject) openSubjectForm((await getSubjects()).find((subject) => subject.id === editSubject.dataset.editSubject), router);
    if (deleteSubject) await deleteSubjectFlow(deleteSubject.dataset.deleteSubject, router);
    if (openSubject && !event.target.closest("button")) location.hash = `#/subjects/${openSubject.dataset.openSubject}`;
    if (addContainer) openContainerForm({ subjectId: document.querySelector("[data-subject-id]")?.dataset.subjectId }, router);
    if (editContainer) openContainerForm((await all("containers")).find((container) => container.id === editContainer.dataset.editContainer), router);
    if (deleteContainer) await deleteContainerFlow(deleteContainer.dataset.deleteContainer, router);
    if (openContainer && !event.target.closest("button")) location.hash = `#/containers/${openContainer.dataset.openContainer}`;
  });
  document.addEventListener("input", async (event) => {
    if (!event.target.matches("[data-subject-search]")) return;
    const page = document.querySelector("[data-subject-id]");
    const query = event.target.value.trim().toLowerCase();
    const containers = (await all("containers")).filter((item) => item.subjectId === page.dataset.subjectId && item.name.toLowerCase().includes(query));
    const materials = await all("materials");
    page.querySelector("#containerList").innerHTML = renderContainers(containers, materials);
  });
}

function openSubjectForm(subject = {}, router) {
  modal(subject.id ? "Edit Subject" : "Add Subject", `
    <form id="subjectForm" class="form-grid">
      ${formField({ label: "Subject name", name: "name", value: subject.name || "", required: true })}
      ${formField({ label: "Description", name: "description", value: subject.description || "" })}
      <div class="field"><label for="color">Accent color</label><input id="color" name="color" type="color" value="${escapeHtml(subject.color || COLORS[0])}"></div>
      <div class="actions"><button class="button" type="submit">Save Subject</button><button class="ghost-button" type="button" data-close-modal>Cancel</button></div>
    </form>
  `);
  document.querySelector("#subjectForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = getForm(event.currentTarget);
    if (!data.name.trim()) return toast("Subject name is required");
    const saved = await save("subjects", { ...subject, ...data, name: data.name.trim() });
    if (!subject.id) {
      for (const name of DEFAULT_CONTAINERS) await save("containers", { subjectId: saved.id, name, color: data.color });
    }
    closeModal();
    toast("Subject saved");
    router.refresh();
  });
}

function openContainerForm(container = {}, router) {
  if (!container.subjectId) return toast("Open a subject before adding containers");
  modal(container.id ? "Edit Container" : "Add Container", `
    <form id="containerForm" class="form-grid">
      ${formField({ label: "Container name", name: "name", value: container.name || "", required: true })}
      ${formField({ label: "Description", name: "description", value: container.description || "" })}
      <div class="field"><label for="color">Accent color</label><input id="color" name="color" type="color" value="${escapeHtml(container.color || COLORS[1])}"></div>
      <div class="actions"><button class="button" type="submit">Save Container</button><button class="ghost-button" type="button" data-close-modal>Cancel</button></div>
    </form>
  `);
  document.querySelector("#containerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = getForm(event.currentTarget);
    if (!data.name.trim()) return toast("Container name is required");
    await save("containers", { ...container, ...data, name: data.name.trim() });
    closeModal();
    toast("Container saved");
    router.refresh();
  });
}

async function deleteSubjectFlow(id, router) {
  const ok = await confirmDialog({ title: "Delete subject?", message: "This deletes the subject, its containers, notes, and file records from this browser." });
  if (!ok) return;
  const containers = (await all("containers")).filter((container) => container.subjectId === id);
  const materials = await all("materials");
  for (const material of materials.filter((item) => item.subjectId === id)) await remove("materials", material.id);
  for (const container of containers) await remove("containers", container.id);
  await remove("subjects", id);
  toast("Subject deleted");
  router.refresh();
}

async function deleteContainerFlow(id, router) {
  const ok = await confirmDialog({ title: "Delete container?", message: "This deletes the container and every material inside it." });
  if (!ok) return;
  for (const material of (await all("materials")).filter((item) => item.containerId === id)) await remove("materials", material.id);
  await remove("containers", id);
  toast("Container deleted");
  router.refresh();
}

function notFound(title) {
  return `<section class="page">${emptyState(title, "Return to the dashboard and choose an existing item.", `<a class="button" href="#/">Dashboard</a>`)}</section>`;
}
