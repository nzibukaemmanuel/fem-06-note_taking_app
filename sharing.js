// sharing.js
// Builds and decodes "Share Note" links. This app has no backend, so a
// shared note can't live in a database only the sharer's browser can read —
// instead the note's data travels inside the link itself, base64url-encoded
// into the URL hash (never sent to a server, unlike the query string) of a
// standalone page (shared-note.html) that needs no login to view.

import { sanitizeRichText } from './noteManager.js';

const toBase64Url = (json) =>
  btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64Url = (value) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return decodeURIComponent(escape(atob(padded)));
};

/**
 * Builds a unique, self-contained, read-only share link for one note.
 * `token` guarantees uniqueness even if the same note is shared twice in the
 * same instant; it isn't looked up anywhere since there's no server to hold it.
 */
export const buildShareLink = (note) => {
  const payload = {
    token: crypto.randomUUID(),
    title: note.title,
    content: note.content,
    tags: note.tags,
    sharedAt: new Date().toISOString(),
  };
  const url = new URL('shared-note.html', window.location.href);
  url.hash = toBase64Url(JSON.stringify(payload));
  return url.href;
};

/**
 * Decodes a shared-note link's hash back into note data. Returns null if the
 * hash is missing, corrupted, or doesn't decode to a usable note. The hash
 * comes from a URL — anyone can hand-edit it — so every field is re-checked,
 * and `content` is run back through the same rich-text allow-list used when
 * a note is saved, so a crafted link can't smuggle in a script tag.
 */
export const decodeShareLink = (hash) => {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;

  try {
    const payload = JSON.parse(fromBase64Url(raw));
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.title !== 'string' || !payload.title.trim()) return null;

    return {
      title: payload.title,
      content: sanitizeRichText(typeof payload.content === 'string' ? payload.content : ''),
      tags: Array.isArray(payload.tags) ? payload.tags.filter((t) => typeof t === 'string') : [],
      sharedAt: typeof payload.sharedAt === 'string' ? payload.sharedAt : null,
    };
  } catch {
    return null;
  }
};
