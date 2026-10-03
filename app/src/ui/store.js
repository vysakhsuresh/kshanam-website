/**
 * What the visitor typed, kept on their device.
 *
 * CLAUDE.md: details are saved locally so a refresh or a second invite never
 * loses their typing, and nothing is ever uploaded. Every access is wrapped,
 * because localStorage throws in private windows and on phones with site data
 * blocked, and a thrown error here must never stop the page rendering.
 */
const KEY = 'kshanam.details.v1';
const UI_KEY = 'kshanam.ui.v1';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
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

export const DEFAULT_DETAILS = {
  templateId: 'kasavu-gold',
  occasion: 'wedding',
  name1: 'Anjali',
  name2: 'Rahul',
  dateISO: '2027-02-14',
  time: '10:30',
  venue: 'Kalyana Mandapam, Thrissur',
  customLine: '',
  inviteLang: 'both',
  music: 'tones',
  endCard: true,
};

export const DEFAULT_UI = {
  // Site language, separate from the language printed on the invite.
  lang: 'en',
  occasion: 'wedding',
};

export const loadDetails = () => read(KEY, DEFAULT_DETAILS);
export const saveDetails = (d) => write(KEY, d);
export const loadUi = () => read(UI_KEY, DEFAULT_UI);
export const saveUi = (u) => write(UI_KEY, u);

/**
 * The photo is held in memory only. Putting a photo in localStorage would
 * both blow the quota and leave a copy of someone's family picture on a
 * shared phone, which is the opposite of the promise on the home page.
 */
let photoFile = null;
export const setPhoto = (file) => { photoFile = file; };
export const getPhoto = () => photoFile;
