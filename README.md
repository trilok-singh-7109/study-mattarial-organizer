# Study Organizer

A polished local-first web application for organizing a student's weekly timetable, subjects, material folders, uploaded files, notes, and daily reminders.

## Features

- Dashboard focused on the current day and today's classes.
- Weekly timetable editor with Monday-Sunday entries.
- Local subject workspaces with customizable material containers.
- File upload to IndexedDB for PDFs, images, text files, Office documents, and other study files.
- Native previews for PDFs, images, plain text, and notes where browsers support them.
- Create, edit, rename, preview, download, and delete notes/materials.
- Daily reminders with add, edit, complete, and delete.
- Global search across subjects, containers, note content, and file names.
- Light, dark, and system theme preference.
- JSON export/import backup, including uploaded file blobs encoded into portable data URLs.
- Strong confirmation before clearing all local data.

## Technology

This project intentionally uses a lightweight static architecture:

- HTML5
- CSS3
- Modern JavaScript ES modules
- IndexedDB for durable local app data and file blobs
- localStorage for lightweight preferences such as theme

There is no backend, cloud account, or external network requirement for core functionality.

## Folder Structure

```text
study-organizer/
  index.html
  css/
    main.css
    components.css
    themes.css
    responsive.css
  js/
    app.js
    storage.js
    timetable.js
    subjects.js
    materials.js
    reminders.js
    ui.js
    utils.js
  data/
    sample-data.json
  assets/
  README.md
```

## How To Run

Because the app uses JavaScript modules, run it through a local static server:

```bash
cd study-organizer
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## IndexedDB Data Model

The app stores these object stores:

- `timetable`: weekly class entries with day, subject, start/end time, room, teacher, notes, timestamps.
- `subjects`: subject workspaces with name, description, accent color, timestamps.
- `containers`: material folders linked by `subjectId`.
- `materials`: note records or file records linked by `subjectId` and `containerId`; file records include metadata and a local Blob.
- `reminders`: daily reminder text and completion state.

Every major entity uses a unique ID plus created/updated timestamps.

## Backup Behavior

Export downloads a JSON file with organizer records. Uploaded file blobs are encoded as data URLs so they can be restored through Import Data. Very large files can create large backup files and may hit browser memory limits. For critical academic material, keep original files outside the browser as a separate backup too.

## Browser Requirements

Use a modern browser with support for:

- ES modules
- IndexedDB
- Blob and Object URL APIs
- CSS custom properties

## Known Limitations

- OCR/image timetable extraction is not implemented; pasted schedule text parsing and manual entry are supported.
- DOC/DOCX and PPT/PPTX files cannot be previewed natively by most browsers, so the app provides download/open fallback.
- Browser storage can be removed if the user clears site data.
- File storage quota is controlled by the browser and device.

## Future Improvements

- Optional CSV timetable import.
- More advanced note formatting.
- Per-reminder due dates.
- Storage quota visualization through the Storage Estimate API.
- Optional encrypted cloud sync while preserving local-first behavior.
