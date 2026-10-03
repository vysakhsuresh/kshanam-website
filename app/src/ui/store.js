/**
 * What the visitor typed, kept on their device.
 *
 * CLAUDE.md: details are saved locally so a refresh or a second invite never
 * loses their typing, and nothing is ever uploaded. Every access is wrapped,
 * because localStorage throws in private windows and on phones with site data
 * blocked, and a thrown error here must never stop the page rendering.
 */
const KEY = 'invita.entry.v2';
const UI_KEY = 'invita.ui.v2';

// The product was called Festa until the name turned out to carry a legal
// risk. Somebody who typed their wedding details yesterday should not lose
// them to a rename, so the old keys are read once and then left alone.
const LEGACY = { 'invita.entry.v2': 'festa.entry.v2', 'invita.ui.v2': 'festa.ui.v2' };

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key) || localStorage.getItem(LEGACY[key] || '');
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_ENTRY = {
  // Where the family's pictures go: 'slide', 'background' or 'both'.
  photoMode: 'slide',
  templateId: 'kasavu-gold',
  music: 'music-box',
  values: {},
};

export const DEFAULT_UI = {
  category: 'all',
};

export const loadEntry = () => read(KEY, DEFAULT_ENTRY);
export const saveEntry = (d) => write(KEY, d);
export const loadUi = () => read(UI_KEY, DEFAULT_UI);
export const saveUi = (u) => write(UI_KEY, u);

/**
 * Photos are held in memory only. Putting one in localStorage would blow the
 * quota and leave a copy of somebody's family picture on a shared phone,
 * which is the opposite of the promise on the home page.
 */
const photoFiles = new Map();
export const setPhotoFile = (slot, file) => { photoFiles.set(slot, file); };
export const getPhotoFile = (slot) => photoFiles.get(slot) || null;
