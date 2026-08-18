import { all, get, remove, save } from "./storage.js";
import { bytes, canPreview, downloadBlob, escapeHtml, fileKind, textToHtml } from "./utils.js";
import { closeModal, confirmDialog, emptyState, formField, getForm, modal, toast } from "./ui.js";

export async function containerPage(containerId) {
  const container = await get("containers", containerId);
  if (!container) return `<section class="page">${emptyState("Container not found", "Choose an existing subject container.", `<a class="button" href="#/subjects">Subjects</a>`)}</section>`;
  const subject = await get("subjects", container.subjectId);
  const materials = (await all("materials")).filter((item) => item.containerId === containerId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return `
    <section class="page" data-page="container" data-container-id="${container.id}" data-subject-id="${container.subjectId}">
      <div class="page-header">
        <div>
          <a class="ghost-button" href="#/subjects/${container.subjectId}">Back to ${escapeHtml(subject?.name || "Subject")}</a>
          <p class="eyebrow section">Material container</p>
          <h1>${escapeHtml(container.name)}</h1>
          <p class="muted">${escapeHtml(container.description || "Files, notes, and pasted study material.")}</p>
        </div>
        <button class="button" data-add-material>Add Material</button>
      </div>
      <div class="stack">${materials.length ? materials.map(renderMaterial).join("") : emptyState("This container is empty", "Add a file, paste text, or create your first note.", `<button class="button" data-add-material>Add Material</button>`)}</div>
    </section>
  `;
}

function renderMaterial(material) {
  return `
    <article class="material-row">
      <div class="file-icon">${escapeHtml(material.kind === "note" ? "NOTE" : fileKind(material.name, material.mimeType))}</div>
      <div>
        <h3>${escapeHtml(material.title || material.name)}</h3>
        <p class="muted">${material.kind === "note" ? "Text note" : `${escapeHtml(material.mimeType || "File")} • ${bytes(material.size)}`} • ${new Date(material.createdAt).toLocaleDateString()}</p>
      </div>
      <div class="actions">
        ${canPreview(material) ? `<button class="mini-button" data-preview-material="${material.id}">Preview</button>` : ""}
        ${material.kind === "note" ? `<button class="mini-button" data-edit-note="${material.id}">Edit</button>` : `<button class="mini-button" data-download-material="${material.id}">Download</button>`}
        <button class="mini-button" data-rename-material="${material.id}">Rename</button>
        <button class="mini-button" data-delete-material="${material.id}">Delete</button>
      </div>
    </article>
  `;
}

export function bindMaterialEvents(router) {
  document.addEventListener("click", async (event) => {
    const add = event.target.closest("[data-add-material]");
    const preview = event.target.closest("[data-preview-material]");
    const download = event.target.closest("[data-download-material]");
    const editNote = event.target.closest("[data-edit-note]");
    const rename = event.target.closest("[data-rename-material]");
    const del = event.target.closest("[data-delete-material]");
    if (add) openMaterialChooser(router);
    if (preview) await openPreview(preview.dataset.previewMaterial);
    if (download) await downloadMaterial(download.dataset.downloadMaterial);
    if (editNote) openNoteForm(await get("materials", editNote.dataset.editNote), router);
    if (rename) openRenameForm(await get("materials", rename.dataset.renameMaterial), router);
    if (del) await deleteMaterial(del.dataset.deleteMaterial, router);
  });
}

function currentContext() {
  const page = document.querySelector("[data-page='container']");
  return page ? { containerId: page.dataset.containerId, subjectId: page.dataset.subjectId } : null;
}

function openMaterialChooser(router) {
  const context = currentContext();
  if (!context) return toast("Open a container before adding material");
  modal("Add Material", `
    <div class="stack">
      <button class="button" data-upload-choice>Upload File</button>
      <button class="ghost-button" data-note-choice>Create Note or Paste Text</button>
      <div class="drop-zone" data-drop-zone>
        <div>
          <strong>Drag files here</strong>
          <p class="muted">PDFs, images, text files, Office documents, and other study files stay local in IndexedDB.</p>
        </div>
      </div>
      <input class="sr-only" id="fileInput" type="file" multiple>
    </div>
  `);
  const input = document.querySelector("#fileInput");
  document.querySelector("[data-upload-choice]").addEventListener("click", () => input.click());
  document.querySelector("[data-note-choice]").addEventListener("click", () => openNoteForm({ ...context, kind: "note" }, router));
  input.addEventListener("change", async () => {
    await addFiles([...input.files], context);
    closeModal();
    router.refresh();
  });
  const zone = document.querySelector("[data-drop-zone]");
  zone.addEventListener("dragover", (event) => event.preventDefault());
  zone.addEventListener("drop", async (event) => {
    event.preventDefault();
    await addFiles([...event.dataTransfer.files], context);
    closeModal();
    router.refresh();
  });
}

async function addFiles(files, context) {
  if (!files.length) return;
  for (const file of files) {
    if (file.size > 100 * 1024 * 1024) {
      toast(`${file.name} is larger than the 100 MB safety limit`);
      continue;
    }
    await save("materials", {
      ...context,
      kind: "file",
      title: file.name,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      blob: file
    });
  }
  toast(`${files.length} material${files.length === 1 ? "" : "s"} added`);
}

function openNoteForm(note, router) {
  const context = currentContext() || note;
  modal(note.id ? "Edit Note" : "Create Note", `
    <form id="noteForm" class="form-grid">
      ${formField({ label: "Title", name: "title", value: note.title || "", required: true })}
      ${formField({ label: "Content", name: "content", value: note.content || "", rows: 12, required: true })}
      <div class="actions"><button class="button" type="submit">Save Note</button><button class="ghost-button" type="button" data-close-modal>Cancel</button></div>
    </form>
  `);
  document.querySelector("#noteForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = getForm(event.currentTarget);
    if (!data.title.trim() || !data.content.trim()) return toast("Note title and content are required");
    await save("materials", { ...note, ...context, ...data, kind: "note", name: data.title.trim(), title: data.title.trim() });
    closeModal();
    toast("Note saved");
    router.refresh();
  });
}

async function openPreview(id) {
  const material = await get("materials", id);
  if (!material) return toast("Material not found");
  if (material.kind === "note") {
    modal(material.title, `<div class="note-content">${textToHtml(material.content)}</div>`);
    return;
  }
  const url = URL.createObjectURL(material.blob);
  const type = material.mimeType || "";
  let body = `<p class="muted">Preview is not available for this file type. Use Download to open it with a local app.</p>`;
  if (type.startsWith("image/")) body = `<img src="${url}" alt="${escapeHtml(material.name)}">`;
  if (type === "application/pdf") body = `<embed class="preview-frame" src="${url}" type="application/pdf">`;
  if (type.startsWith("text/")) body = `<iframe class="preview-frame" src="${url}" title="${escapeHtml(material.name)}"></iframe>`;
  modal(material.title || material.name, `${body}<div class="section actions"><button class="button" data-download-preview>Download</button></div>`);
  document.querySelector("[data-download-preview]")?.addEventListener("click", () => downloadBlob(material.blob, material.name));
  document.querySelector("[data-close-modal]")?.addEventListener("click", () => URL.revokeObjectURL(url), { once: true });
}

async function downloadMaterial(id) {
  const material = await get("materials", id);
  if (!material?.blob) return toast("Download is unavailable for this item");
  downloadBlob(material.blob, material.name);
}

function openRenameForm(material, router) {
  if (!material) return;
  modal("Rename Material", `
    <form id="renameForm" class="form-grid">
      ${formField({ label: "Name", name: "title", value: material.title || material.name, required: true })}
      <div class="actions"><button class="button" type="submit">Save Name</button><button class="ghost-button" type="button" data-close-modal>Cancel</button></div>
    </form>
  `);
  document.querySelector("#renameForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = getForm(event.currentTarget);
    await save("materials", { ...material, title: data.title.trim(), name: material.kind === "note" ? data.title.trim() : material.name });
    closeModal();
    toast("Material renamed");
    router.refresh();
  });
}

async function deleteMaterial(id, router) {
  const ok = await confirmDialog({ title: "Delete material?", message: "This removes the file or note from local browser storage." });
  if (!ok) return;
  await remove("materials", id);
  toast("Material deleted");
  router.refresh();
}
