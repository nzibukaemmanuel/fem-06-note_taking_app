// noteManager.js
// Owns the in-memory notes collection and every operation that changes it.
// Every mutating function persists to storage before returning, so callers
// (main.js) only ever have to re-render.

import * as storage from './storage.js';

/** @typedef {{ city?: string, lat: number, lng: number }} NoteLocation */

export class Note {
  /**
   * @param {string} title
   * @param {string} content
   * @param {string[]} tags
   */
  constructor(title, content, tags = []) {
    this.id = generateId();
    this.title = title.trim();
    this.content = (content || '').trim();
    this.tags = normalizeTags(tags);
    this.archived = false;
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
    /** @type {NoteLocation|null} */
    this.location = null;
    // Manual sort position (lower = higher up the list) — lets drag & drop
    // reorder notes independently of their edit/creation timestamps.
    this.order = Date.now();
  }

  archive() {
    this.archived = !this.archived;
    this.updatedAt = new Date().toISOString();
    return this;
  }

  addTag(tag) {
    const clean = tag.trim().toLowerCase();
    if (clean && !this.tags.includes(clean)) {
      this.tags.push(clean);
      this.updatedAt = new Date().toISOString();
    }
    return this;
  }
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeTags(tags) {
  const list = Array.isArray(tags)
    ? tags
    : String(tags || '').split(',');
  const cleaned = list
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(cleaned)];
}

// ---------------------------------------------------------------------------
// In-memory state, hydrated once at startup by main.js calling init().
// ---------------------------------------------------------------------------

/** @type {Note[]} */
let notes = [];

// Always shown in the sidebar, even before any note uses them, so the tag
// list isn't empty for a brand-new install.
const DEFAULT_TAGS = [
  'cooking', 'dev', 'fitness', 'health', 'personal',
  'react', 'recipes', 'shopping', 'travel', 'typescript',
];

// Shown once on a brand-new install so the list isn't empty. Dates are fixed
// (not "now") so they sort into a stable, believable order.
function buildSampleNotes() {
  const seeds = [
    ['React Performance Optimization', ['dev', 'react'], '2024-10-29',
      'Key performance optimization techniques:\n\n' +
      '1. Code Splitting\n' +
      '- Use React.lazy() for route-based splitting\n' +
      '- Implement dynamic imports for heavy components\n\n' +
      '2. Memoization\n' +
      '- useMemo for expensive calculations\n' +
      '- useCallback for function props\n' +
      '- React.memo for component optimization\n\n' +
      '3. Virtual List Implementation\n' +
      '- Use react-window for long lists\n' +
      '- Implement infinite scrolling\n\n' +
      'TODO: Benchmark current application and identify bottlenecks'],
    ['Japan Travel Planning', ['travel', 'personal'], '2024-10-28',
      'Two-week itinerary for October:\n\n' +
      'Tokyo (5 days) - Shibuya, Asakusa, teamLab Planets, day trip to Nikko\n' +
      'Kyoto (4 days) - Fushimi Inari at sunrise, Arashiyama bamboo grove, tea ceremony\n' +
      'Osaka (3 days) - Dotonbori food crawl, Osaka Castle\n' +
      'Hakone (2 days) - Onsen ryokan, Mt. Fuji views weather permitting\n\n' +
      "TODO: Book the JR Pass before departure — it's cheaper from abroad. Reserve the ryokan at least a month out."],
    ['Favorite Pasta Recipes', ['cooking', 'recipes'], '2024-10-27',
      'Cacio e Pepe\n' +
      '- Pecorino Romano, coarse black pepper, pasta water, patience\n' +
      '- Toast the pepper first, then build the sauce off heat\n\n' +
      'Aglio e Olio\n' +
      '- Garlic sliced thin, sizzled slow in olive oil until golden, not brown\n' +
      '- Chili flakes, reserved pasta water, parsley stirred in at the end\n\n' +
      "Notes: starchy pasta water is the emulsifier — don't skip it, and don't rinse the pasta."],
    ['Weekly Workout Plan', ['fitness', 'health'], '2024-10-25',
      'Mon: upper body push. Tue: legs. Wed: rest or walk.\n' +
      'Thu: upper body pull. Fri: full body. Weekend: optional cardio.\n\n' +
      'Keep a log of weights/reps each session to track progress week over week.'],
    ['Meal Prep Ideas', ['cooking', 'health', 'recipes'], '2024-10-12',
      'Sunday batch cooking:\n' +
      '- Grilled chicken breast (2 lbs), roasted vegetables (broccoli, peppers, zucchini), quinoa\n\n' +
      'Portion into 5 containers. Freeze 2 for later in the week, refrigerate the rest.\n\n' +
      'Quick swaps: brown rice instead of quinoa, tofu instead of chicken for meatless days.'],
    ['Reading List', ['personal', 'dev'], '2024-10-05',
      'Currently reading: Designing Data-Intensive Applications\n' +
      'Up next: A Philosophy of Software Design, Atomic Habits (re-read)\n\n' +
      "Queued: anything recommended in the team's book-club channel."],
    ['Fitness Goals 2025', ['fitness', 'health', 'personal'], '2024-09-22',
      'Q1: Build a consistent 4x/week routine, focus on form over weight\n' +
      'Q2: Add a 5k target, keep strength training 2x/week\n' +
      'H2: Reassess based on progress — possibly a half marathon\n\n' +
      'Track weekly in the fitness app, review monthly.'],
  ];

  return seeds.map(([title, tags, date, content], i) => {
    const note = new Note(title, content, tags);
    note.createdAt = date;
    note.updatedAt = date;
    note.order = i;
    return note;
  });
}

export const init = () => {
  notes = storage.loadNotes();
  if (notes.length === 0 && !storage.wasSeeded()) {
    notes = buildSampleNotes();
    storage.saveNotes(notes);
    storage.markSeeded();
  }
  // Backfill fields for notes saved by an older version of the app.
  let migrated = false;
  notes = notes.map((n, i) => {
    const next = { ...n };
    if (typeof next.order !== 'number') { next.order = i; migrated = true; }
    return next;
  });
  if (migrated) storage.saveNotes(notes);
  return notes;
};

export const getNotes = () => notes;

export const getAllTags = () => {
  const set = new Set(DEFAULT_TAGS);
  notes.forEach((n) => n.tags.forEach((t) => set.add(t)));
  return [...set].sort();
};

export const createNote = (title, content, tags) => {
  const note = new Note(title, content, tags);
  notes = [note, ...notes];
  storage.saveNotes(notes);
  return note;
};

export const deleteNote = (id) => {
  notes = notes.filter((n) => n.id !== id);
  storage.saveNotes(notes);
  return notes;
};

export const updateNote = (id, updates) => {
  let updated = null;
  notes = notes.map((n) => {
    if (n.id !== id) return n;
    updated = {
      ...n,
      ...updates,
      tags: updates.tags !== undefined ? normalizeTags(updates.tags) : n.tags,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });
  storage.saveNotes(notes);
  return updated;
};

export const toggleArchive = (id) => {
  let updated = null;
  notes = notes.map((n) => {
    if (n.id !== id) return n;
    updated = { ...n, archived: !n.archived, updatedAt: new Date().toISOString() };
    return updated;
  });
  storage.saveNotes(notes);
  return updated;
};

/**
 * Adds notes parsed from an imported JSON file to the existing collection
 * (rather than replacing it). Each entry gets a fresh id/order so imported
 * notes can never collide with — or overwrite — what's already saved.
 * Entries without a usable title are skipped. Returns how many were added.
 */
export const importNotes = (rawNotes) => {
  if (!Array.isArray(rawNotes)) {
    throw new Error('That file doesn\'t contain a list of notes.');
  }

  let nextOrder = notes.reduce((max, n) => Math.max(max, n.order ?? 0), 0) + 1;
  const imported = rawNotes.reduce((acc, raw) => {
    const title = String(raw?.title || '').trim();
    if (!title) return acc;
    const note = new Note(title, raw.content, raw.tags);
    note.archived = Boolean(raw.archived);
    if (raw.createdAt) note.createdAt = raw.createdAt;
    if (raw.updatedAt) note.updatedAt = raw.updatedAt;
    if (raw.location) note.location = raw.location;
    note.order = nextOrder++;
    acc.push(note);
    return acc;
  }, []);

  notes = [...notes, ...imported];
  storage.saveNotes(notes);
  return imported.length;
};

export const searchNotes = (query, list = notes) => {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((n) =>
    n.title.toLowerCase().includes(q) ||
    n.content.toLowerCase().includes(q) ||
    n.tags.some((t) => t.includes(q))
  );
};

export const filterByTag = (tag, list = notes) => {
  if (!tag) return list;
  return list.filter((n) => n.tags.includes(tag));
};

export const filterByArchived = (archived, list = notes) =>
  list.filter((n) => Boolean(n.archived) === archived);

/**
 * Drag & drop reorder (bonus): move note `draggedId` to just before
 * `targetId` in the manual sort order, renumbering `order` for every note
 * so ties never happen.
 */
export const reorderNotes = (draggedId, targetId) => {
  if (draggedId === targetId) return notes;
  const list = [...notes].sort((a, b) => a.order - b.order);
  const fromIndex = list.findIndex((n) => n.id === draggedId);
  if (fromIndex === -1) return notes;
  const [moved] = list.splice(fromIndex, 1);
  let toIndex = list.findIndex((n) => n.id === targetId);
  if (toIndex === -1) toIndex = list.length;
  list.splice(toIndex, 0, moved);
  list.forEach((n, i) => { n.order = i; });
  notes = notes.map((n) => list.find((m) => m.id === n.id) || n);
  storage.saveNotes(notes);
  return notes;
};

