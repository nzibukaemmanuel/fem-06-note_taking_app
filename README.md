# Marginalia — Note Taking App

A client-side note-taking app: DOM manipulation, event delegation,
`localStorage`/`sessionStorage`, and the Geolocation API — no backend, no
build step.

## Run it

Because it uses ES6 modules, open it through a local server rather than
`file://` (modules are blocked by CORS on `file://` in most browsers).


`the VS Code "Live Server" extension, or npx serve`.

## Project structure

Matches the assignment's required module layout exactly — five JS files,
nothing more:

| File | Responsibility |
|---|---|
| `storage.js` | All `localStorage`/`sessionStorage` reads & writes: notes, preferences, drafts, and (for the demo login system) accounts/session/reset-requests. Only place that touches Web Storage. |
| `noteManager.js` | `Note` class + in-memory notes array; create/update/delete/search/filter/reorder. Persists via `storage.js` after every mutation. |
| `ui.js` | Pure rendering: note cards, tag/folder sidebars, the markdown preview renderer, validation messages, toasts. Never touches storage. |
| `themes.js` | Applies/persists color theme (light/dark/auto) and font family (sans/serif/mono). |
| `main.js` | The single entry point every page loads. Detects which page it's on and wires up only that page: the notes app (`index.html`), or one of the four auth pages (login/signup/forgot-password/reset-password). |

`main.js` is intentionally the biggest file — it's where the former
`auth.js`, `brand.js`, `login.js`, `signup.js`, `forgot-password.js`, and
`reset-password.js` all got merged in, each as its own `initXPage()`
function, so the project still has exactly the five required modules. The
five HTML pages are unchanged; they now all load the same `main.js` and
`styles.css` (the former `auth.css` was merged into `styles.css`).

**One necessary exception:** `service-worker.js` (for the offline/PWA
bonus) has to be its own file — a service worker registers against a
specific script URL and browsers won't let you register one bundled inside
another script.

## Features implemented

- **CRUD**: create, edit (modal), archive/unarchive, delete (with confirm dialog), all synced to `localStorage`.
- **Tags**: comma-separated tag input, deduped, sidebar tag filter, click a tag again to clear it.
- **Folders/categories (bonus)**: assign a note to a folder (or create a new one inline), filter by folder in the sidebar, drag a note onto a folder chip to move it.
- **Search**: live filtering across title/content/tags, with match highlighting (`<mark>`).
- **Archive view**: separate "All notes" / "Archived" views with counts; drag a note onto "Archived Notes" / "All Notes" to (un)archive it.
- **Drag & drop (bonus)**: reorder notes in the list, or drag onto a folder/archive target as above.
- **Drafts**: while creating a new note, title/content/tags/folder autosave to `sessionStorage` every 300ms and are restored if you reload or reopen the tab; cleared on successful save.
- **Formatting toolbar + Markdown preview (bonus)**: Bold/Italic/Bulleted list/Numbered list/Link buttons insert lightweight markdown syntax into the note; a "Preview" toggle renders that markdown (safely, HTML-escaped first) instead of full `contenteditable` rich text, so there's one consistent format instead of two competing ones.
- **Export / Import (bonus)**: export all notes as a `.json` file; import merges a previously-exported file back in without duplicating existing notes.
- **Note sharing (bonus)**: "Share Note" encodes the note directly into a URL (no server involved) — uses the native share sheet if available, otherwise shows a copyable link. Opening a shared link prompts the recipient to add a read-only copy to their own notes.
- **Dark mode auto-detection (bonus)**: a new "Auto" theme option (alongside Light/Dark) follows the OS/browser `prefers-color-scheme` setting live; it's also the default for a first-time visitor.
- **Offline support (bonus)**: a service worker caches the app shell, so the app (and its `localStorage` data) still opens with no connection.
- **Geolocation (bonus)**: "Add my location" button uses `navigator.geolocation`, attempts reverse geocoding to a city name (falls back to raw coordinates), and handles permission denial/timeouts gracefully.
- **Validation**: title required, min 3 characters, inline error message, submit disabled until valid, validates on blur and on submit.
- **Theme & font system**: light/dark/auto theme and sans/serif/mono font, applied via `data-theme`/`data-font` attributes on `<html>` and persisted.
- **Accessibility**: semantic landmarks, skip link, visible focus rings, native `<dialog>` for modals (built-in focus trap + Escape-to-close + focus return), `aria-live` regions for toasts and validation, labelled form fields, keyboard-operable everywhere (drag & drop has click-based fallbacks — reorder isn't keyboard-only yet, a good next step).
- **Responsive**: CSS grid note layout, collapsible sidebar drawer with scrim on narrow viewports, touch-sized buttons.
- **Demo accounts (kept from the original build)**: signup/login/forgot-password/reset-password, all client-side only — an "account" is just a SHA-256 password hash in `localStorage`, there's no real backend or email delivery.

## Design notes

The UI keeps its "notebook" point of view: a dot-grid backdrop, colored tag
chips, and a font switcher (sans/serif/mono) that's treated as a real
typographic feature. Bonus features were designed to sit inside that
existing visual language rather than bolt on a different style — folders
reuse the tag-chip look, the formatting toolbar sits quietly above the
textarea, and the share/import dialogs reuse the existing modal styling.
