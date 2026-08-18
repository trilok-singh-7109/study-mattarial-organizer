import { escapeHtml } from "./utils.js";

const modalRoot = document.querySelector("#modalRoot");
const toastRoot = document.querySelector("#toastRoot");

export function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  toastRoot.append(el);
  setTimeout(() => el.remove(), 3200);
}

export function closeModal() {
  modalRoot.innerHTML = "";
}

modalRoot.addEventListener("click", (event) => {
  if (event.target === modalRoot || event.target.closest("[data-close-modal]")) {
    closeModal();
  }
});

export function modal(title, body, footer = "") {
  modalRoot.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <header>
        <div>
          <p class="eyebrow">Study Organizer</p>
          <h2 id="modalTitle">${escapeHtml(title)}</h2>
        </div>
        <button class="icon-button" type="button" data-close-modal aria-label="Close dialog">×</button>
      </header>
      <div>${body}</div>
      ${footer ? `<footer class="section">${footer}</footer>` : ""}
    </section>
  `;
  modalRoot.querySelector("input, textarea, select, button")?.focus();
}

export function confirmDialog({ title, message, confirmText = "Delete", danger = true }) {
  return new Promise((resolve) => {
    modal(title, `<p class="muted">${escapeHtml(message)}</p>`, `
      <div class="actions">
        <button class="${danger ? "danger-button" : "button"}" type="button" data-confirm>${escapeHtml(confirmText)}</button>
        <button class="ghost-button" type="button" data-cancel>Cancel</button>
      </div>
    `);
    modalRoot.querySelector("[data-confirm]").addEventListener("click", () => {
      closeModal();
      resolve(true);
    });
    modalRoot.querySelector("[data-cancel]").addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
  });
}

export function emptyState(title, message, action = "") {
  return `
    <div class="empty-state">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p class="muted">${escapeHtml(message)}</p>
        ${action}
      </div>
    </div>
  `;
}

export function formField({ label, name, value = "", type = "text", required = false, options = null, rows = null, placeholder = "" }) {
  const requiredText = required ? "required" : "";
  if (options) {
    return `
      <div class="field">
        <label for="${name}">${escapeHtml(label)}</label>
        <select id="${name}" name="${name}" ${requiredText}>
          ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </div>
    `;
  }
  if (rows) {
    return `
      <div class="field">
        <label for="${name}">${escapeHtml(label)}</label>
        <textarea id="${name}" name="${name}" rows="${rows}" placeholder="${escapeHtml(placeholder)}" ${requiredText}>${escapeHtml(value)}</textarea>
      </div>
    `;
  }
  return `
    <div class="field">
      <label for="${name}">${escapeHtml(label)}</label>
      <input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${requiredText}>
    </div>
  `;
}

export function getForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function setActiveNav(path) {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const target = link.getAttribute("data-nav");
    link.classList.toggle("active", target === path || (target !== "/" && path.startsWith(target)));
  });
}
