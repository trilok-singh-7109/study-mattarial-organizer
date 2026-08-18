export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function uid(prefix = "id") {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
}

export function now() {
  return new Date().toISOString();
}

export function todayName(date = new Date()) {
  return DAYS[date.getDay()];
}

export function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

export function textToHtml(value = "") {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

export function bytes(size = 0) {
  if (!size) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function byCreated(a, b) {
  return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
}

export function byTime(a, b) {
  return `${a.startTime || ""}${a.endTime || ""}`.localeCompare(`${b.startTime || ""}${b.endTime || ""}`);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileKind(fileName = "", mime = "") {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (mime.startsWith("image/")) return "IMG";
  if (mime === "application/pdf" || ext === "pdf") return "PDF";
  if (mime.startsWith("text/") || ext === "txt" || ext === "md") return "TXT";
  if (["doc", "docx"].includes(ext)) return "DOC";
  if (["ppt", "pptx"].includes(ext)) return "PPT";
  return ext ? ext.slice(0, 4).toUpperCase() : "FILE";
}

export function canPreview(material) {
  const type = material.mimeType || "";
  return material.kind === "note" || type.startsWith("image/") || type.startsWith("text/") || type === "application/pdf";
}

export function parseScheduleText(text) {
  const entries = [];
  let currentDay = "";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const dayMatch = line.match(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*:?\s*$/i);
    if (dayMatch) {
      currentDay = dayMatch[1][0].toUpperCase() + dayMatch[1].slice(1).toLowerCase();
      continue;
    }
    const entryMatch = line.match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?\s+(.+)$/i);
    if (currentDay && entryMatch) {
      const [, sh, sm = "00", sap = "", eh, em = "00", eap = "", subject] = entryMatch;
      entries.push({
        day: currentDay,
        startTime: normalizeTime(sh, sm, sap || eap),
        endTime: normalizeTime(eh, em, eap || sap),
        subject: subject.trim()
      });
    }
  }
  return entries;
}

function normalizeTime(hour, minute, ampm) {
  let h = Number(hour);
  const m = String(minute).padStart(2, "0");
  const period = String(ampm).toLowerCase();
  if (period === "pm" && h < 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
}
