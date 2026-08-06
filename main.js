// main.js
// The one entry script every page in this project loads. It detects which
// page it's running on and only wires up that page — this is why the whole
// project needs just five JS modules (storage.js, noteManager.js, ui.js,
// themes.js, main.js) instead of one file per page.
//
// 
import * as storage from './storage.js';
import * as noteManager from './noteManager.js';
import * as ui from './ui.js';
import * as themes from './themes.js';
import * as sharing from './sharing.js';

// ============================================================================
// Shared auth helpers
// Small, dependency-free helpers used by every auth-page controller below
// (password hashing, token generation, field errors, a toast, the password
// show/hide toggle). Nothing here touches storage directly — that's
// storage.js's job — and nothing here is exported; only this file needs it.
// ============================================================================

const toHex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 hex digest, so a password never gets written to localStorage in plain text. */
const hashPassword = async (password) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return toHex(new Uint8Array(digest));
};

/** Random token for reset-password links (stands in for what a real backend would email). */
const generateToken = () => toHex(crypto.getRandomValues(new Uint8Array(16)));

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Wires an eye-icon button to toggle an adjacent input between password/text. */
const initPasswordToggle = (toggleBtn, input) => {
  if (!toggleBtn || !input) return;
  toggleBtn.addEventListener('click', () => {
    const isRevealing = input.type === 'password';
    input.type = isRevealing ? 'text' : 'password';
    toggleBtn.setAttribute('aria-pressed', String(isRevealing));
    toggleBtn.setAttribute('aria-label', isRevealing ? 'Hide password' : 'Show password');
    toggleBtn.querySelector('use').setAttribute('href', isRevealing ? '#icon-eye-off' : '#icon-eye');
  });
};

/** Show (or clear) a validation error under an auth form field. */
const setFieldError = (input, errorEl, message) => {
  input.classList.toggle('is-invalid', Boolean(message));
  input.setAttribute('aria-invalid', String(Boolean(message)));
  if (errorEl) errorEl.textContent = message || '';
};

/** login.html/signup.html only make sense signed out — bounce an existing session straight in. */
const redirectIfAuthenticated = () => {
  if (storage.loadSession()) window.location.replace('index.html');
};

/** Every auth page's "Google" button does the same not-really-implemented thing. */
const wireGoogleButton = (btn) => {
  if (!btn) return;
  btn.addEventListener('click', () => {
    ui.showFeedback("Google sign-in isn't available in this demo.", { type: 'error' });
  });
};

// ============================================================================
// Login page
// ============================================================================

function initLoginPage() {
  themes.applySavedPreferences();
  redirectIfAuthenticated();

  const form = document.getElementById('auth-form');
  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('email-error');
  const passwordInput = document.getElementById('password');
  const passwordError = document.getElementById('password-error');
  const passwordToggle = document.getElementById('password-toggle');
  const googleBtn = document.getElementById('google-btn');

  initPasswordToggle(passwordToggle, passwordInput);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    let valid = true;
    if (!isValidEmail(email)) {
      setFieldError(emailInput, emailError, 'Enter a valid email address.');
      valid = false;
    } else {
      setFieldError(emailInput, emailError, '');
    }
    if (!password) {
      setFieldError(passwordInput, passwordError, 'Enter your password.');
      valid = false;
    } else {
      setFieldError(passwordInput, passwordError, '');
    }
    if (!valid) {
      (emailInput.classList.contains('is-invalid') ? emailInput : passwordInput).focus();
      return;
    }

    const user = storage.findUserByEmail(email);
    const passwordHash = await hashPassword(password);

    if (!user || user.passwordHash !== passwordHash) {
      ui.showFeedback('Incorrect email or password.', { type: 'error' });
      passwordInput.focus();
      return;
    }

    storage.saveSession(email);
    ui.showFeedback('Welcome back! Redirecting…');
    setTimeout(() => { window.location.href = 'index.html'; }, 500);
  });

  wireGoogleButton(googleBtn);
}

// ============================================================================
// Signup page
// ============================================================================

function initSignupPage() {
  themes.applySavedPreferences();
  redirectIfAuthenticated();

  const form = document.getElementById('auth-form');
  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('email-error');
  const passwordInput = document.getElementById('password');
  const passwordError = document.getElementById('password-error');
  const passwordToggle = document.getElementById('password-toggle');
  const googleBtn = document.getElementById('google-btn');

  initPasswordToggle(passwordToggle, passwordInput);

  function validate() {
    let valid = true;
    if (!isValidEmail(emailInput.value.trim())) {
      setFieldError(emailInput, emailError, 'Enter a valid email address.');
      valid = false;
    } else {
      setFieldError(emailInput, emailError, '');
    }
    if (passwordInput.value.length < 8) {
      setFieldError(passwordInput, passwordError, 'Password must be at least 8 characters.');
      valid = false;
    } else {
      setFieldError(passwordInput, passwordError, '');
    }
    return valid;
  }

  emailInput.addEventListener('blur', validate);
  passwordInput.addEventListener('blur', validate);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) {
      (emailInput.classList.contains('is-invalid') ? emailInput : passwordInput).focus();
      return;
    }

    const email = emailInput.value.trim();
    if (storage.findUserByEmail(email)) {
      setFieldError(emailInput, emailError, 'An account with this email already exists.');
      emailInput.focus();
      return;
    }

    const passwordHash = await hashPassword(passwordInput.value);
    storage.addUser({ email, passwordHash });
    storage.saveSession(email);

    ui.showFeedback('Account created! Redirecting…');
    setTimeout(() => { window.location.href = 'index.html'; }, 600);
  });

  wireGoogleButton(googleBtn);
}

// ============================================================================
// Forgot-password page
// ============================================================================

function initForgotPasswordPage() {
  themes.applySavedPreferences();

  const form = document.getElementById('auth-form');
  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('email-error');
  const demoNotice = document.getElementById('demo-reset-notice');
  const demoLink = document.getElementById('demo-reset-link');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      setFieldError(emailInput, emailError, 'Enter a valid email address.');
      emailInput.focus();
      return;
    }
    setFieldError(emailInput, emailError, '');

    const token = generateToken();
    storage.saveResetRequest(email, token);

    form.hidden = true;
    // Deliberately doesn't reveal whether the email actually has an account —
    // the reset-password page is what actually rejects unknown emails.
    ui.showFeedback(`If an account exists for ${email}, reset instructions have been sent.`);

    demoLink.href = `reset-password.html?email=${encodeURIComponent(email)}&token=${token}`;
    demoNotice.hidden = false;
  });
}

// ============================================================================
// Reset-password page
// ============================================================================

function initResetPasswordPage() {
  themes.applySavedPreferences();

  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || '';
  const token = params.get('token') || '';

  const formView = document.getElementById('reset-form-view');
  const invalidNotice = document.getElementById('invalid-link-notice');
  const form = document.getElementById('auth-form');
  const passwordInput = document.getElementById('password');
  const passwordError = document.getElementById('password-error');
  const passwordToggle = document.getElementById('password-toggle');
  const confirmInput = document.getElementById('confirm-password');
  const confirmError = document.getElementById('confirm-password-error');
  const confirmToggle = document.getElementById('confirm-password-toggle');

  const request = storage.loadResetRequest();
  const linkIsValid = Boolean(
    request &&
    email &&
    request.email.toLowerCase() === email.toLowerCase() &&
    request.token === token &&
    request.expiresAt > Date.now() &&
    storage.findUserByEmail(email)
  );

  if (!linkIsValid) {
    formView.hidden = true;
    invalidNotice.hidden = false;
    return;
  }

  initPasswordToggle(passwordToggle, passwordInput);
  initPasswordToggle(confirmToggle, confirmInput);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let valid = true;
    if (passwordInput.value.length < 8) {
      setFieldError(passwordInput, passwordError, 'Password must be at least 8 characters.');
      valid = false;
    } else {
      setFieldError(passwordInput, passwordError, '');
    }
    if (confirmInput.value !== passwordInput.value) {
      setFieldError(confirmInput, confirmError, "Passwords don't match.");
      valid = false;
    } else {
      setFieldError(confirmInput, confirmError, '');
    }
    if (!valid) {
      (passwordInput.classList.contains('is-invalid') ? passwordInput : confirmInput).focus();
      return;
    }

    const passwordHash = await hashPassword(passwordInput.value);
    storage.updateUserPassword(email, passwordHash);
    storage.clearResetRequest();

    form.hidden = true;

    // "Change Password" (in the notes app settings) reaches this page while
    // already logged in — sending that visitor to login.html would just
    // bounce them straight back to index.html, leaving a stale message.
    const alreadySignedIn = storage.loadSession();
    const destination = alreadySignedIn ? 'index.html' : 'login.html';
    ui.showFeedback(alreadySignedIn ? 'Password updated!' : 'Password updated! Redirecting to login…');
    setTimeout(() => { window.location.href = destination; }, 900);
  });
}

// ============================================================================
// Shared-note page (shared-note.html) — a read-only view reachable with no
// login, since the note's data lives entirely in the link (see sharing.js).
// ============================================================================

function initSharedNotePage() {
  themes.applySavedPreferences();

  const view = document.getElementById('shared-note-view');
  const missing = document.getElementById('shared-note-missing');

  const note = sharing.decodeShareLink(window.location.hash);
  if (!note) {
    missing.hidden = false;
    return;
  }

  document.getElementById('shared-note-title').textContent = note.title;

  const tagsEl = document.getElementById('shared-note-tags');
  note.tags.forEach((tag) => {
    const li = document.createElement('li');
    li.className = 'shared-note-tag';
    li.textContent = tag;
    tagsEl.appendChild(li);
  });

  document.getElementById('shared-note-meta').textContent = note.sharedAt
    ? `Shared on ${new Date(note.sharedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
    : '';

  // Safe to set directly: decodeShareLink() already ran `content` through the
  // same rich-text allow-list sanitizer notes are saved with.
  const contentEl = document.getElementById('shared-note-content');
  if (note.content.trim()) {
    contentEl.innerHTML = note.content;
  } else {
    contentEl.textContent = 'This note has no content.';
    contentEl.classList.add('shared-note-content-empty');
  }

  view.hidden = false;
}

// ============================================================================
// Notes app (index.html)
// ============================================================================

function initNotesApp() {
  // ---------------------------------------------------------------------
  // Elements
  // ---------------------------------------------------------------------

  const searchInput = document.getElementById('search-input');
  const notesListEl = document.getElementById('notes-list');
  const tagListEl = document.getElementById('tag-list');
  const folderListEl = document.getElementById('folder-list');
  const filterButtons = document.querySelectorAll('.filter-btn[data-filter]');
  const exportNotesBtn = document.getElementById('export-notes-btn');
  const importNotesBtn = document.getElementById('import-notes-btn');
  const importNotesInput = document.getElementById('import-notes-input');

  const mobileFolderList = document.getElementById('mobile-folder-list');

  const newNoteBtn = document.getElementById('new-note-btn');
  const noteForm = document.getElementById('note-form');
  const emptyDetail = document.getElementById('empty-detail');
  const saveBtn = document.getElementById('save-btn');
  const cancelBtn = document.getElementById('cancel-btn');

  const noteIdInput = document.getElementById('note-id');
  const noteTitleInput = document.getElementById('note-title');
  const noteContentInput = document.getElementById('note-content');
  const noteTagsInput = document.getElementById('note-tags');
  const noteFolderInput = document.getElementById('note-folder');
  const lastEditedRow = document.getElementById('last-edited-row');
  const lastEditedEl = document.getElementById('note-last-edited');

  const addLocationBtn = document.getElementById('add-location-btn');
  const locationDisplay = document.getElementById('location-display');

  const actionsPanel = document.getElementById('actions-panel');
  const shareNoteBtn = document.getElementById('share-note-btn');
  const archiveNoteBtn = document.getElementById('archive-note-btn');
  const archiveNoteLabel = document.getElementById('archive-note-label');
  const deleteNoteBtn = document.getElementById('delete-note-btn');

  const shareModal = document.getElementById('share-modal');
  const shareLinkInput = document.getElementById('share-link-input');
  const shareCopyBtn = document.getElementById('share-copy-btn');
  const shareCloseBtn = document.getElementById('share-close-btn');

  const confirmModal = document.getElementById('confirm-modal');
  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  const confirmBodyText = document.getElementById('confirm-body-text');

  const archiveModal = document.getElementById('archive-modal');
  const archiveModalTitle = document.getElementById('archive-modal-title');
  const archiveModalText = document.getElementById('archive-modal-text');
  const archiveCancelBtn = document.getElementById('archive-cancel-btn');
  const archiveConfirmBtn = document.getElementById('archive-confirm-btn');

  const settingsBtn = document.getElementById('settings-btn');
  const settingsView = document.getElementById('settings-view');
  const settingsSectionThemeBtn = document.getElementById('settings-section-theme-btn');
  const settingsSectionFontBtn = document.getElementById('settings-section-font-btn');
  const settingsBackBtn = document.getElementById('settings-back-btn');
  const settingsDetailTheme = document.getElementById('settings-detail-theme');
  const settingsDetailFont = document.getElementById('settings-detail-font');
  const themeOptions = document.getElementById('theme-options');
  const fontOptions = document.getElementById('font-options');
  const applyThemeBtn = document.getElementById('apply-theme-btn');
  const applyFontBtn = document.getElementById('apply-font-btn');
  const changePasswordBtn = document.getElementById('change-password-btn');
  const logoutBtn = document.getElementById('logout-btn');

  const viewTitle = document.getElementById('view-title');
  const viewSubtitle = document.getElementById('view-subtitle');

  const appEl = document.getElementById('app');
  const fabNewNoteBtn = document.getElementById('fab-new-note-btn');
  const mobileTabbar = document.getElementById('mobile-tabbar');
  const mobileDetailBackBtn = document.getElementById('mobile-detail-back-btn');
  const mobileDetailToolbarIcons = document.getElementById('mobile-detail-toolbar-icons');
  const mobileShareBtn = document.getElementById('mobile-share-btn');
  const mobileDeleteBtn = document.getElementById('mobile-delete-btn');
  const mobileArchiveBtn = document.getElementById('mobile-archive-btn');
  const mobileCancelBtn = document.getElementById('mobile-cancel-btn');
  const mobileSaveBtn = document.getElementById('mobile-save-btn');

  const mobileSearchView = document.getElementById('mobile-search-view');
  const mobileSearchBackBtn = document.getElementById('mobile-search-back-btn');
  const mobileSearchForm = document.getElementById('mobile-search-form');
  const mobileSearchInput = document.getElementById('mobile-search-input');
  const mobileSearchResults = document.getElementById('mobile-search-results');
  const mobileSearchEmpty = document.getElementById('mobile-search-empty');
  const mobileSearchEmptyBody = document.getElementById('mobile-search-empty-body');

  const mobileTagsView = document.getElementById('mobile-tags-view');
  const mobileTagsBackBtn = document.getElementById('mobile-tags-back-btn');
  const mobileTagList = document.getElementById('mobile-tag-list');

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------

  const state = {
    filter: 'all',        // 'all' | 'archived'
    tag: null,             // string | null
    folder: null,          // string | null
    search: '',
    selectedId: null,      // note id currently shown in the detail panel
    isCreating: false,     // true while composing a brand-new (unsaved) note
    pendingLocation: null,
    pendingDeleteId: null,
    pendingArchiveId: null,
    draggedId: null,       // note id currently being dragged (drag & drop bonus)
    view: 'notes',         // 'notes' | 'settings'
    settingsSection: 'root', // 'root' | 'theme' | 'font' — 'root' only means something on phones
    pendingTheme: null,    // staged (not-yet-applied) theme/font selection in the Settings view
    pendingFont: null,
  };

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------

  function getVisibleNotes() {
    let list = noteManager.filterByArchived(state.filter === 'archived');
    if (state.tag) list = noteManager.filterByTag(state.tag, list);
    if (state.folder) list = noteManager.filterByFolder(state.folder, list);
    if (state.search) list = noteManager.searchNotes(state.search, list);
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function emptyMessage() {
    if (state.search) return `No notes match "${state.search}".`;
    if (state.tag) return `No notes tagged ${state.tag} yet.`;
    if (state.folder) return `No notes in "${state.folder}" yet.`;
    if (state.filter === 'archived') return 'Nothing archived. Notes you archive will land here.';
    return 'Write your first note — it takes less time than finding a pen.';
  }

  function updateHeader() {
    if (state.view === 'settings') {
      viewTitle.textContent = 'Settings';
      viewSubtitle.textContent = '';
      return;
    }
    viewTitle.textContent = state.filter === 'archived' ? 'Archived Notes' : 'All Notes';
    const parts = [];
    if (state.folder) parts.push(`in ${state.folder}`);
    if (state.tag) parts.push(`tagged ${state.tag}`);
    if (state.search) parts.push(`matching "${state.search}"`);
    viewSubtitle.textContent = parts.join(' · ');
  }

  function render() {
    const visible = getVisibleNotes();
    ui.renderNotesList(visible, {
      highlight: state.search,
      emptyMessage: emptyMessage(),
      selectedId: state.selectedId,
    });
    ui.updateTagList(noteManager.getAllTags(), state.tag);
    ui.updateFolderList(noteManager.getFolders(), state.folder);
    ui.toggleArchiveView(state.filter === 'archived');
    updateHeader();
    updateMobileTabbar();
    renderSettingsView();
  }

  // ---------------------------------------------------------------------
  // Detail panel helpers
  // ---------------------------------------------------------------------

  /** On phones, list and detail are separate full-screen steps rather than stacked panels. */
  function setMobileView(view) {
    appEl.dataset.mobileView = view;
  }

  function showForm() {
    noteForm.hidden = false;
    emptyDetail.hidden = true;
  }

  function closeDetail() {
    state.selectedId = null;
    state.isCreating = false;
    state.pendingLocation = null;
    noteForm.hidden = true;
    emptyDetail.hidden = false;
    actionsPanel.hidden = true;
    mobileDetailToolbarIcons.hidden = true;
    noteForm.reset();
    ui.showValidationError('note-title', '');
    setMobileView('list');
    render();
  }

  function fillFormFrom(note) {
    noteIdInput.value = note.id;
    noteTitleInput.value = note.title;
    noteContentInput.innerHTML = note.content;
    noteTagsInput.value = note.tags.join(', ');
    noteFolderInput.value = note.folder || 'UNCATEGORIZED';
    lastEditedRow.hidden = false;
    lastEditedEl.textContent = new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    locationDisplay.textContent = note.location
      ? `📍 ${note.location.city || `${note.location.lat.toFixed(2)}, ${note.location.lng.toFixed(2)}`}`
      : '';
    ui.showValidationError('note-title', '');
    saveBtn.disabled = false;
  }

  function setArchiveButtonLabel(archived) {
    archiveNoteLabel.textContent = archived ? 'Unarchive Note' : 'Archive Note';
  }

  /** Toast shown after a note's archived state changes, with a link to jump to where it landed. */
  function showArchiveToast(archived) {
    ui.showFeedback(archived ? 'Note archived.' : 'Note restored to active notes.', {
      action: {
        label: archived ? 'Archived Notes' : 'All Notes',
        onClick: () => {
          state.filter = archived ? 'archived' : 'all';
          setMobileView('list');
          render();
        },
      },
    });
  }

  function selectNote(note) {
    state.selectedId = note.id;
    state.isCreating = false;
    state.pendingLocation = note.location || null;
    fillFormFrom(note);
    setArchiveButtonLabel(note.archived);
    showForm();
    actionsPanel.hidden = false;
    mobileDetailToolbarIcons.hidden = false;
    setMobileView('detail');
    render();
  }

  function openCreate() {
    state.selectedId = null;
    state.isCreating = true;
    state.pendingLocation = null;

    noteForm.reset();
    noteIdInput.value = '';
    noteContentInput.innerHTML = ''; // form.reset() doesn't touch contenteditable elements
    noteFolderInput.value = 'UNCATEGORIZED';
    lastEditedRow.hidden = true;
    locationDisplay.textContent = '';
    ui.showValidationError('note-title', '');
    saveBtn.disabled = true;

    restoreDraftIfAny();
    showForm();
    actionsPanel.hidden = true;
    mobileDetailToolbarIcons.hidden = true;
    setMobileView('detail');
    render();
    noteTitleInput.focus();
  }

  // ---------------------------------------------------------------------
  // Validation + drafts
  // ---------------------------------------------------------------------

  function isTitleValid() {
    return noteTitleInput.value.trim().length >= 3;
  }

  function validateTitle({ showError = true } = {}) {
    const value = noteTitleInput.value.trim();
    if (value.length === 0) {
      if (showError) ui.showValidationError('note-title', 'Title is required.');
      return false;
    }
    if (value.length < 3) {
      if (showError) ui.showValidationError('note-title', 'Title needs at least 3 characters.');
      return false;
    }
    ui.showValidationError('note-title', '');
    return true;
  }

  noteTitleInput.addEventListener('input', () => {
    saveBtn.disabled = !isTitleValid();
    if (noteTitleInput.classList.contains('is-invalid')) validateTitle();
    autosaveDraft();
  });
  noteTitleInput.addEventListener('blur', () => validateTitle());

  let draftTimeout = null;
  function autosaveDraft() {
    if (!state.isCreating) return; // only draft new notes, edits are already persisted
    clearTimeout(draftTimeout);
    draftTimeout = setTimeout(() => {
      if (!state.isCreating) return; // the note may have been saved while this was pending
      const draft = {
        title: noteTitleInput.value,
        content: noteContentInput.innerHTML,
        tags: noteTagsInput.value,
      };
      if (draft.title || draft.content || draft.tags) {
        storage.saveDraft(draft);
      }
    }, 300);
  }
  noteContentInput.addEventListener('input', autosaveDraft);
  noteTagsInput.addEventListener('input', autosaveDraft);

  function restoreDraftIfAny() {
    const draft = storage.loadDraft();
    if (!draft) return;
    noteTitleInput.value = draft.title || '';
    noteContentInput.innerHTML = draft.content || '';
    noteTagsInput.value = draft.tags || '';
    saveBtn.disabled = !isTitleValid();
    if (draft.title || draft.content) {
      ui.showFeedback('Restored your unsaved draft.');
    }
  }

  // ---------------------------------------------------------------------
  // Form submit (create / update) + cancel
  // ---------------------------------------------------------------------

  noteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateTitle()) {
      noteTitleInput.focus();
      return;
    }

    const title = noteTitleInput.value.trim();
    const content = noteContentInput.innerHTML.trim();
    const tags = noteTagsInput.value;
    const folder = noteFolderInput.value;

    if (state.isCreating) {
      const note = noteManager.createNote(title, content, tags, folder);
      if (state.pendingLocation) {
        noteManager.updateNote(note.id, { location: state.pendingLocation });
      }
      storage.clearDraft();
      ui.showFeedback('Note saved successfully!');
      selectNote(noteManager.getNotes().find((n) => n.id === note.id));
    } else if (state.selectedId) {
      noteManager.updateNote(state.selectedId, { title, content, tags, folder, location: state.pendingLocation });
      ui.showFeedback('Note updated successfully!');
      selectNote(noteManager.getNotes().find((n) => n.id === state.selectedId));
    }
  });

  newNoteBtn.addEventListener('click', openCreate);
  fabNewNoteBtn.addEventListener('click', openCreate);
  mobileDetailBackBtn.addEventListener('click', () => {
    if (state.isCreating) storage.clearDraft();
    closeDetail();
  });

  function discardChanges() {
    if (state.isCreating) {
      storage.clearDraft();
      closeDetail();
      return;
    }
    if (state.selectedId) {
      const note = noteManager.getNotes().find((n) => n.id === state.selectedId);
      if (note) {
        fillFormFrom(note);
        state.pendingLocation = note.location || null;
        ui.showFeedback('Changes discarded.');
      }
    }
  }

  cancelBtn.addEventListener('click', discardChanges);
  mobileCancelBtn.addEventListener('click', discardChanges);
  mobileSaveBtn.addEventListener('click', () => noteForm.requestSubmit());

  // ---------------------------------------------------------------------
  // Rich text formatting: Bold / Italic / Underline toolbar above the
  // content editor. Uses execCommand — deprecated broadly, but these three
  // specific commands remain reliably supported everywhere, and writing a
  // custom Selection/Range-based toggler would buy nothing here.
  // ---------------------------------------------------------------------

  try {
    document.execCommand('defaultParagraphSeparator', false, 'br');
  } catch {
    // Unsupported in some browsers — Enter just falls back to its default behavior.
  }
  const formatButtons = document.querySelectorAll('.format-btn');

  function updateFormatButtonStates() {
    formatButtons.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(document.queryCommandState(btn.dataset.command)));
    });
  }

  formatButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      noteContentInput.focus();
      document.execCommand(btn.dataset.command);
      updateFormatButtonStates();
      autosaveDraft();
    });
  });

  noteContentInput.addEventListener('keyup', updateFormatButtonStates);
  noteContentInput.addEventListener('mouseup', updateFormatButtonStates);
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === noteContentInput) updateFormatButtonStates();
  });

  // ---------------------------------------------------------------------
  // Geolocation (bonus browser API)
  // ---------------------------------------------------------------------

  addLocationBtn.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
      locationDisplay.textContent = 'Geolocation is not supported on this device.';
      return;
    }
    locationDisplay.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        let city = null;
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
          );
          if (res.ok) {
            const data = await res.json();
            city = data.city || data.locality || null;
          }
        } catch {
          // Reverse geocoding is a nice-to-have; coordinates alone are fine.
        }
        state.pendingLocation = { lat, lng, city };
        locationDisplay.textContent = `📍 ${city || `${lat.toFixed(2)}, ${lng.toFixed(2)}`}`;
      },
      (error) => {
        state.pendingLocation = null;
        locationDisplay.textContent =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission denied.'
            : 'Could not get your location.';
      },
      { timeout: 8000 }
    );
  });

  // ---------------------------------------------------------------------
  // Note list selection + drag & drop (reorder / archive)
  // ---------------------------------------------------------------------

  /** Shared by the main notes list and the mobile full-screen search results. */
  function activateNoteListItem(item) {
    const note = noteManager.getNotes().find((n) => n.id === item.dataset.id);
    if (!note) return;
    selectNote(note);
    closeMobileOverlays();
  }

  [notesListEl, mobileSearchResults].forEach((list) => {
    list.addEventListener('click', (e) => {
      const item = e.target.closest('.note-item');
      if (item) activateNoteListItem(item);
    });
    list.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const item = e.target.closest('.note-item');
      if (!item) return;
      e.preventDefault();
      activateNoteListItem(item);
    });
  });

  notesListEl.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.note-item');
    if (!item) return;
    state.draggedId = item.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.id);
    item.classList.add('is-dragging');
  });

  notesListEl.addEventListener('dragend', (e) => {
    const item = e.target.closest('.note-item');
    if (item) item.classList.remove('is-dragging');
    state.draggedId = null;
  });

  notesListEl.addEventListener('dragover', (e) => {
    if (!state.draggedId) return;
    e.preventDefault();
    const item = e.target.closest('.note-item');
    notesListEl.querySelectorAll('.note-item.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
    if (item && item.dataset.id !== state.draggedId) item.classList.add('is-drag-over');
  });

  notesListEl.addEventListener('drop', (e) => {
    if (!state.draggedId) return;
    e.preventDefault();
    const item = e.target.closest('.note-item');
    notesListEl.querySelectorAll('.note-item.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
    if (item && item.dataset.id !== state.draggedId) {
      noteManager.reorderNotes(state.draggedId, item.dataset.id);
      render();
    }
  });

  // Drop a dragged note onto "Archived Notes" / "All Notes" to (un)archive it.
  filterButtons.forEach((btn) => {
    btn.addEventListener('dragover', (e) => {
      if (!state.draggedId) return;
      e.preventDefault();
      btn.classList.add('is-drag-over');
    });
    btn.addEventListener('dragleave', () => btn.classList.remove('is-drag-over'));
    btn.addEventListener('drop', (e) => {
      if (!state.draggedId) return;
      e.preventDefault();
      btn.classList.remove('is-drag-over');
      const note = noteManager.getNotes().find((n) => n.id === state.draggedId);
      if (!note) return;
      const wantsArchived = btn.dataset.filter === 'archived';
      if (Boolean(note.archived) !== wantsArchived) {
        noteManager.toggleArchive(note.id);
        showArchiveToast(wantsArchived);
        render();
      }
    });
  });

  // ---------------------------------------------------------------------
  // Actions panel: archive / delete the currently selected note
  // ---------------------------------------------------------------------

  function archiveSelectedNote() {
    if (!state.selectedId) return;
    const note = noteManager.getNotes().find((n) => n.id === state.selectedId);
    if (note) openArchiveConfirm(note);
  }

  function deleteSelectedNote() {
    if (!state.selectedId) return;
    const note = noteManager.getNotes().find((n) => n.id === state.selectedId);
    if (note) openDeleteConfirm(note);
  }

  archiveNoteBtn.addEventListener('click', archiveSelectedNote);
  deleteNoteBtn.addEventListener('click', deleteSelectedNote);
  mobileArchiveBtn.addEventListener('click', archiveSelectedNote);
  mobileDeleteBtn.addEventListener('click', deleteSelectedNote);

  function openShareModal() {
    if (!state.selectedId) return;
    const note = noteManager.getNotes().find((n) => n.id === state.selectedId);
    if (!note) return;
    shareLinkInput.value = sharing.buildShareLink(note);
    shareModal.showModal();
    shareLinkInput.focus();
    shareLinkInput.select();
  }

  shareNoteBtn.addEventListener('click', openShareModal);
  mobileShareBtn.addEventListener('click', openShareModal);
  shareCloseBtn.addEventListener('click', () => shareModal.close());

  shareCopyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareLinkInput.value);
      ui.showFeedback('Share link copied to clipboard!');
    } catch {
      shareLinkInput.select();
      ui.showFeedback("Couldn't copy automatically — the link is selected, so press Ctrl+C.", { type: 'error' });
    }
  });

  function openDeleteConfirm(note) {
    state.pendingDeleteId = note.id;
    confirmBodyText.textContent = `"${note.title}" will be permanently deleted. This can't be undone.`;
    confirmModal.showModal();
    confirmDeleteBtn.focus();
  }

  confirmCancelBtn.addEventListener('click', () => confirmModal.close());
  confirmDeleteBtn.addEventListener('click', () => {
    if (state.pendingDeleteId) {
      noteManager.deleteNote(state.pendingDeleteId);
      ui.showFeedback('Note permanently deleted.');
      confirmModal.close();
      closeDetail();
    }
  });
  confirmModal.addEventListener('close', () => {
    state.pendingDeleteId = null;
  });

  function openArchiveConfirm(note) {
    state.pendingArchiveId = note.id;
    if (note.archived) {
      archiveModalTitle.textContent = 'Unarchive note?';
      archiveModalText.textContent = `"${note.title}" will move back to All Notes.`;
      archiveConfirmBtn.textContent = 'Unarchive';
    } else {
      archiveModalTitle.textContent = 'Archive note?';
      archiveModalText.textContent = `"${note.title}" will move to Archived Notes. You can unarchive it later.`;
      archiveConfirmBtn.textContent = 'Archive';
    }
    archiveModal.showModal();
    archiveConfirmBtn.focus();
  }

  archiveCancelBtn.addEventListener('click', () => archiveModal.close());
  archiveConfirmBtn.addEventListener('click', () => {
    if (state.pendingArchiveId) {
      const updated = noteManager.toggleArchive(state.pendingArchiveId);
      archiveModal.close();
      selectNote(updated);
      showArchiveToast(updated.archived);
    }
  });
  archiveModal.addEventListener('close', () => {
    state.pendingArchiveId = null;
  });

  // ---------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------

  let searchTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.search = searchInput.value.trim();
      render();
    }, 150);
  });
  document.getElementById('search-form').addEventListener('submit', (e) => e.preventDefault());

  // ---------------------------------------------------------------------
  // Sidebar: view filter (all / archived) and tag filter.
  // Shared by the desktop sidebar and the mobile Tags full-screen view.
  // ---------------------------------------------------------------------

  function selectFilter(filter) {
    state.filter = filter;
    state.view = 'notes';
    setMobileView('list');
    render();
  }

  function selectTag(tag) {
    state.tag = state.tag === tag ? null : tag;
    state.view = 'notes';
    closeMobileOverlays();
    setMobileView('list');
    render();
  }

  function selectFolder(folder) {
    state.folder = state.folder === folder ? null : folder;
    state.view = 'notes';
    closeMobileOverlays();
    setMobileView('list');
    render();
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => selectFilter(btn.dataset.filter));
  });

  exportNotesBtn.addEventListener('click', () => {
    const json = JSON.stringify(noteManager.getNotes(), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'notes-export.json';
    link.click();
    URL.revokeObjectURL(url);
    ui.showFeedback('Notes exported successfully!');
  });

  importNotesBtn.addEventListener('click', () => importNotesInput.click());
  importNotesInput.addEventListener('change', async () => {
    const file = importNotesInput.files[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const { importedCount, skippedCount, duplicateCount } = noteManager.importNotes(parsed);

      if (importedCount === 0) {
        let notice = 'That file has no notes to import.';
        if (duplicateCount > 0 && skippedCount > 0) notice = 'No new notes — every entry was either a duplicate or invalid.';
        else if (duplicateCount > 0) notice = 'No new notes — all of them already exist.';
        else if (skippedCount > 0) notice = 'None of the entries in that file were valid notes.';
        ui.showFeedback(notice, { type: 'error' });
        return;
      }

      const caveats = [];
      if (duplicateCount > 0) caveats.push(`skipped ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'}`);
      if (skippedCount > 0) caveats.push(`skipped ${skippedCount} invalid ${skippedCount === 1 ? 'entry' : 'entries'}`);

      const message = `Imported ${importedCount} note${importedCount === 1 ? '' : 's'}` +
        (caveats.length ? ` — ${caveats.join(', ')}.` : ' successfully!');
      ui.showFeedback(message, caveats.length ? { duration: 6000 } : undefined);
      render();
    } catch (err) {
      ui.showFeedback(
        err instanceof SyntaxError
          ? "That file isn't valid JSON."
          : (err.message || "Couldn't import that file."),
        { type: 'error' }
      );
    } finally {
      importNotesInput.value = '';
    }
  });

  [tagListEl, mobileTagList].forEach((list) => {
    list.addEventListener('click', (e) => {
      const chip = e.target.closest('.tag-chip');
      if (chip) selectTag(chip.dataset.tag);
    });
  });

  [folderListEl, mobileFolderList].forEach((list) => {
    list.addEventListener('click', (e) => {
      const chip = e.target.closest('.tag-chip');
      if (chip) selectFolder(chip.dataset.folderName);
    });
  });

  // ---------------------------------------------------------------------
  // Settings view — a full page (like "All Notes"/"Archived Notes") rather
  // than a dropdown, with a section sub-nav (always visible on desktop,
  // shown as its own screen on phones) and Color Theme / Font Theme detail
  // sections that stage a choice until "Apply Changes" commits it.
  // ---------------------------------------------------------------------

  function openSettingsView() {
    state.view = 'settings';
    state.settingsSection = 'root';
    state.pendingTheme = themes.getThemeMode();
    state.pendingFont = themes.getFont();
    render();
  }

  function closeSettingsView() {
    state.view = 'notes';
    render();
  }

  function selectSettingsSection(section) {
    state.settingsSection = section;
    if (section === 'theme') state.pendingTheme = themes.getThemeMode();
    if (section === 'font') state.pendingFont = themes.getFont();
    render();
  }

  function renderSettingsView() {
    appEl.dataset.view = state.view;
    appEl.dataset.settingsSection = state.settingsSection;
    settingsView.hidden = state.view !== 'settings';
    settingsBtn.classList.toggle('is-active', state.view === 'settings');
    settingsBtn.setAttribute('aria-pressed', String(state.view === 'settings'));

    const effectiveSection = state.settingsSection === 'root' ? 'theme' : state.settingsSection;
    settingsDetailTheme.hidden = effectiveSection !== 'theme';
    settingsDetailFont.hidden = effectiveSection !== 'font';
    settingsSectionThemeBtn.classList.toggle('is-active', effectiveSection === 'theme');
    settingsSectionFontBtn.classList.toggle('is-active', effectiveSection === 'font');

    themeOptions.querySelectorAll('.theme-option').forEach((btn) => {
      const checked = btn.dataset.value === state.pendingTheme;
      btn.classList.toggle('is-selected', checked);
      btn.setAttribute('aria-checked', String(checked));
    });
    applyThemeBtn.disabled = !state.pendingTheme || state.pendingTheme === themes.getThemeMode();

    fontOptions.querySelectorAll('.theme-option').forEach((btn) => {
      const checked = btn.dataset.value === state.pendingFont;
      btn.classList.toggle('is-selected', checked);
      btn.setAttribute('aria-checked', String(checked));
    });
    applyFontBtn.disabled = !state.pendingFont || state.pendingFont === themes.getFont();
  }

  settingsBtn.addEventListener('click', () => {
    state.view === 'settings' ? closeSettingsView() : openSettingsView();
  });

  settingsBackBtn.addEventListener('click', () => selectSettingsSection('root'));
  settingsSectionThemeBtn.addEventListener('click', () => selectSettingsSection('theme'));
  settingsSectionFontBtn.addEventListener('click', () => selectSettingsSection('font'));

  themeOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-option');
    if (!btn) return;
    state.pendingTheme = btn.dataset.value;
    renderSettingsView();
  });
  applyThemeBtn.addEventListener('click', () => {
    themes.applyTheme(state.pendingTheme);
    ui.showFeedback('Settings updated successfully!');
    renderSettingsView();
  });

  fontOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-option');
    if (!btn) return;
    state.pendingFont = btn.dataset.value;
    renderSettingsView();
  });
  applyFontBtn.addEventListener('click', () => {
    themes.applyFont(state.pendingFont);
    ui.showFeedback('Settings updated successfully!');
    renderSettingsView();
  });

  changePasswordBtn.addEventListener('click', () => {
    const session = storage.loadSession();
    if (!session) return;
    // Reuses the reset-password flow rather than a separate page: it already
    // knows how to take a new password and write the hash, and the reset
    // token still guards against the form being reachable without this click.
    const token = generateToken();
    storage.saveResetRequest(session.email, token);
    window.location.href = `reset-password.html?email=${encodeURIComponent(session.email)}&token=${token}`;
  });

  logoutBtn.addEventListener('click', () => {
    storage.clearSession();
    window.location.href = 'login.html';
  });

  // ---------------------------------------------------------------------
  // Mobile navigation: bottom tab bar, FAB, and the Search/Tags full-screen
  // views that replace the desktop sidebar's search box and tag list
  // on phones (see the `@media (max-width: 860px)` rules in styles.css).
  // ---------------------------------------------------------------------

  function closeMobileOverlays() {
    mobileSearchView.hidden = true;
    mobileTagsView.hidden = true;
    updateMobileTabbar();
  }

  function updateMobileTabbar() {
    let active = state.filter === 'archived' ? 'archived' : 'home';
    if (!mobileSearchView.hidden) active = 'search';
    else if (!mobileTagsView.hidden) active = 'tags';
    else if (state.view === 'settings') active = 'settings';

    mobileTabbar.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === active);
    });
  }

  function renderMobileSearchResults() {
    const query = mobileSearchInput.value.trim();
    const list = query ? noteManager.searchNotes(query) : [];
    ui.renderNotesList(list, {
      highlight: query,
      emptyMessage: query ? `No notes match "${query}".` : 'Start typing to search your notes.',
      selectedId: state.selectedId,
      listEl: mobileSearchResults,
      emptyStateEl: mobileSearchEmpty,
      emptyBodyEl: mobileSearchEmptyBody,
    });
  }

  function openMobileSearch() {
    mobileSearchView.hidden = false;
    renderMobileSearchResults();
    updateMobileTabbar();
    mobileSearchInput.focus();
  }

  function openMobileTags() {
    mobileTagsView.hidden = false;
    ui.updateTagList(noteManager.getAllTags(), state.tag, { listEl: mobileTagList });
    ui.updateFolderList(noteManager.getFolders(), state.folder, { listEl: mobileFolderList });
    updateMobileTabbar();
  }

  let mobileSearchTimeout = null;
  mobileSearchInput.addEventListener('input', () => {
    clearTimeout(mobileSearchTimeout);
    mobileSearchTimeout = setTimeout(renderMobileSearchResults, 150);
  });
  mobileSearchForm.addEventListener('submit', (e) => e.preventDefault());
  mobileSearchBackBtn.addEventListener('click', closeMobileOverlays);
  mobileTagsBackBtn.addEventListener('click', closeMobileOverlays);

  mobileTabbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const tab = btn.dataset.tab;
    closeMobileOverlays();

    if (tab === 'settings') {
      state.view === 'settings' ? closeSettingsView() : openSettingsView();
      return;
    }

    if (state.view === 'settings') closeSettingsView();
    if (tab === 'home') selectFilter('all');
    else if (tab === 'archived') selectFilter('archived');
    else if (tab === 'search') openMobileSearch();
    else if (tab === 'tags') openMobileTags();
  });

  // ---------------------------------------------------------------------
  // Keyboard: Escape closes whichever overlay is open.
  // ---------------------------------------------------------------------

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!mobileSearchView.hidden || !mobileTagsView.hidden) closeMobileOverlays();
    if (state.view === 'settings') closeSettingsView();
  });

  // ---------------------------------------------------------------------
  // PWA: offline support (bonus)
  // ---------------------------------------------------------------------

  if ('serviceWorker' in navigator) {
    // Registration silently no-ops (and rejects) on file:// or unsupported
    // setups, which is fine — the rest of the app doesn't depend on it.
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  // ---------------------------------------------------------------------
  // Startup
  // ---------------------------------------------------------------------

  function init() {
    document.getElementById('storage-warning').hidden = storage.isStorageAvailable();

    themes.applySavedPreferences();
    noteManager.init();

    noteFolderInput.innerHTML = '';
    noteManager.getFolders().forEach((folder) => {
      const option = document.createElement('option');
      option.value = folder.name;
      option.textContent = folder.name;
      noteFolderInput.appendChild(option);
    });

    setMobileView('list');
    render();

    // If a draft exists from a previous session, let the user know they can
    // resume it via "+ Create New Note".
    const draft = storage.loadDraft();
    if (draft && (draft.title || draft.content)) {
      ui.showFeedback('You have an unsaved draft — open "+ Create New Note" to resume it.');
    }
  }

  init();
}

// ============================================================================
// Page dispatch
// ============================================================================

if (document.getElementById('app')) {
  initNotesApp();
} else {
  switch (document.body.dataset.authPage) {
    case 'login': initLoginPage(); break;
    case 'signup': initSignupPage(); break;
    case 'forgot-password': initForgotPasswordPage(); break;
    case 'reset-password': initResetPasswordPage(); break;
    case 'shared-note': initSharedNotePage(); break;
    default: break;
  }
}
