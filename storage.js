// storage.js
// Everything that touches localStorage / sessionStorage lives here so the
// rest of the app never has to think about serialization or quota errors.

// v2: the example-note set changed shape (different sample notes/tags), so
// the key is bumped to give anyone who already loaded the old samples a
// clean slate instead of a stale mix of old and new seed data.
const NOTES_KEY = 'marginalia:notes:v2';
const PREFS_KEY = 'marginalia:preferences';
const DRAFT_KEY = 'marginalia:draft';
const SEEDED_KEY = 'marginalia:seeded:v2';
const USERS_KEY = 'marginalia:users';
const SESSION_KEY = 'marginalia:session';
const RESET_KEY = 'marginalia:reset-request';

// Reset links "expire" after 15 minutes, the same way a real emailed
// reset link would — long enough to actually use, short enough not to linger.
const RESET_TTL_MS = 15 * 60 * 1000;

// Bonus: default to 'auto' (follow the OS/browser color-scheme preference)
// rather than hard-coding light, so a first-time visitor sees the theme
// their system already prefers. See themes.js for how 'auto' is resolved.
const DEFAULT_PREFS = { theme: 'auto', font: 'sans' };

// ---------------------------------------------------------------------------
// Generic read/write/remove — every function below is a thin, typed wrapper
// around one of these three, so the try/catch + fallback logic lives in
// exactly one place. `store` picks localStorage vs sessionStorage (drafts
// only need to survive the tab, everything else should persist).
// ---------------------------------------------------------------------------

const read = (store, key, fallback, label) => {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Could not read ${label}:`, err);
    return fallback;
  }
};

const write = (store, key, value, label) => {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`Could not save ${label}:`, err);
    return false;
  }
};

const remove = (store, key, label) => {
  try {
    store.removeItem(key);
  } catch (err) {
    console.error(`Could not clear ${label}:`, err);
  }
};

const readArray = (key, label) => {
  const value = read(localStorage, key, [], label);
  return Array.isArray(value) ? value : [];
};

/**
 * Browsers block localStorage on file:// pages (opaque origin), which makes
 * every save fail silently. Call this once at startup so the app can warn
 * the user instead of pretending notes were saved.
 */
export const isStorageAvailable = () => {
  try {
    const testKey = '__marginalia_storage_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch (err) {
    return false;
  }
};

export const saveNotes = (notes) => write(localStorage, NOTES_KEY, notes, 'notes');
export const loadNotes = () => readArray(NOTES_KEY, 'notes');

export const savePreferences = (prefs) => write(localStorage, PREFS_KEY, prefs, 'preferences');
export const loadPreferences = () => ({ ...DEFAULT_PREFS, ...read(localStorage, PREFS_KEY, {}, 'preferences') });

/**
 * Drafts live in sessionStorage: they're only meant to survive an accidental
 * reload/tab-close within the same session, not to persist forever.
 */
export const saveDraft = (draft) => write(sessionStorage, DRAFT_KEY, draft, 'draft');
export const loadDraft = () => read(sessionStorage, DRAFT_KEY, null, 'draft');
export const clearDraft = () => remove(sessionStorage, DRAFT_KEY, 'draft');

/**
 * Tracks whether the one-time example notes have already been added, so a
 * user who deletes everything gets a genuinely empty list instead of the
 * samples reappearing on next load.
 */
export const wasSeeded = () => {
  try {
    return localStorage.getItem(SEEDED_KEY) === '1';
  } catch (err) {
    return false;
  }
};

export const markSeeded = () => {
  try {
    localStorage.setItem(SEEDED_KEY, '1');
  } catch (err) {
    console.error('Could not persist seed marker:', err);
  }
};

/**
 * Accounts, session, and reset-request storage for the auth pages
 * (signup/login/forgot-password/reset-password). There's no backend here,
 * so "signing up" just means writing a record to localStorage — passwords
 * are stored as SHA-256 hashes (see auth.js), never in plain text.
 */

export const loadUsers = () => readArray(USERS_KEY, 'users');
export const saveUsers = (users) => write(localStorage, USERS_KEY, users, 'users');

export const findUserByEmail = (email) =>
  loadUsers().find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;

export const addUser = (user) => saveUsers([...loadUsers(), user]);

export const updateUserPassword = (email, passwordHash) => {
  const users = loadUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return false;
  user.passwordHash = passwordHash;
  return saveUsers(users);
};

export const saveSession = (email) => write(localStorage, SESSION_KEY, { email }, 'session');
export const loadSession = () => read(localStorage, SESSION_KEY, null, 'session');
export const clearSession = () => remove(localStorage, SESSION_KEY, 'session');

export const saveResetRequest = (email, token) =>
  write(localStorage, RESET_KEY, { email, token, expiresAt: Date.now() + RESET_TTL_MS }, 'reset request');
export const loadResetRequest = () => read(localStorage, RESET_KEY, null, 'reset request');
export const clearResetRequest = () => remove(localStorage, RESET_KEY, 'reset request');