// themes.js
// Applies theme/font choices to the document root and persists them.
// Kept deliberately small: theme, font, and the "auto" dark-mode bonus.

import * as storage from './storage.js';

const root = document.documentElement;
const VALID_THEMES = ['light', 'dark', 'auto'];
const VALID_FONTS = ['sans', 'serif', 'mono'];

const media = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

/** Resolve 'auto' to whatever the OS currently prefers; pass 'light'/'dark' straight through. */
const resolveTheme = (theme) => {
  if (theme === 'auto') return media && media.matches ? 'dark' : 'light';
  return theme;
};

export const applyTheme = (themeName, { persist = true } = {}) => {
  const theme = VALID_THEMES.includes(themeName) ? themeName : 'light';
  root.setAttribute('data-theme', resolveTheme(theme));
  root.setAttribute('data-theme-mode', theme);

  if (persist) {
    const prefs = storage.loadPreferences();
    storage.savePreferences({ ...prefs, theme });
  }
  return theme;
};

export const applyFont = (fontName, { persist = true } = {}) => {
  const font = VALID_FONTS.includes(fontName) ? fontName : 'sans';
  root.setAttribute('data-font', font);

  if (persist) {
    const prefs = storage.loadPreferences();
    storage.savePreferences({ ...prefs, font });
  }
  return font;
};

/** The currently applied theme mode ('light' | 'dark' | 'auto'). */
export const getThemeMode = () => root.getAttribute('data-theme-mode') || 'light';

/** The currently applied font. */
export const getFont = () => root.getAttribute('data-font') || 'sans';

// While the theme mode is 'auto', keep the app in sync if the OS setting
// changes mid-session (bonus: dark-mode auto-detection).
if (media) {
  const onChange = () => {
    if (root.getAttribute('data-theme-mode') === 'auto') {
      root.setAttribute('data-theme', resolveTheme('auto'));
    }
  };
  if (media.addEventListener) media.addEventListener('change', onChange);
  else if (media.addListener) media.addListener(onChange);
}

/** Apply whatever was saved (or defaults) — call once on startup. */
export const applySavedPreferences = () => {
  const prefs = storage.loadPreferences();
  // First-ever visit (no saved theme at all): default to the OS preference
  // instead of hard-coding light, per the "dark-mode auto-detection" bonus.
  const theme = prefs.theme || 'auto';
  applyTheme(theme, { persist: false });
  applyFont(prefs.font, { persist: false });
  return { ...prefs, theme };
};
