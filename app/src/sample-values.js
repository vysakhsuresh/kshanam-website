/**
 * The details the site starts with.
 *
 * CLAUDE.md asks for sample details to be prefilled, so the first thing a
 * visitor sees is a finished-looking invite rather than an empty form.
 */
export const SAMPLE = {
  name1: 'Anjali',
  name2: 'Rahul',
  dateISO: '2027-02-14',
  time: '10:30',
  venue: 'Kalyana Mandapam, Thrissur',
  customLine: '',
};

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const DAYS_ML = ['ഞായർ', 'തിങ്കൾ', 'ചൊവ്വ', 'ബുധൻ', 'വ്യാഴം', 'വെള്ളി', 'ശനി'];
const MONTHS_ML = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ',
  'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];

/**
 * Spelled out by hand rather than with Intl, because the invite has to read
 * the same on every phone and old Android builds disagree about Malayalam
 * month names.
 */
export function formatDate(iso, lang) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay();
  return lang === 'ml'
    ? `${DAYS_ML[day]}, ${d} ${MONTHS_ML[m - 1]} ${y}`
    : `${DAYS_EN[day]}, ${d} ${MONTHS_EN[m - 1]} ${y}`;
}

/** "10:30" -> "Muhurtham 10:30 AM" / "മുഹൂർത്തം 10:30 AM" */
export function formatTime(hhmm, lang) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return '';
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const clock = `${hour12}:${String(m || 0).padStart(2, '0')} ${suffix}`;
  return lang === 'ml' ? `മുഹൂർത്തം ${clock}` : `Muhurtham ${clock}`;
}

/** Turn the form's fields into the slots a template asks for. */
export function toSlots(details, lang) {
  const textLang = lang === 'ml' ? 'ml' : 'en';
  return {
    name1: details.name1 || '',
    name2: details.name2 || '',
    dateLong: formatDate(details.dateISO, textLang),
    timeText: formatTime(details.time, textLang),
    venue: details.venue || '',
    customLine: details.customLine || '',
    domain: '[YOUR DOMAIN]',
  };
}

export function sampleValues(lang = 'both') {
  return { slots: toSlots(SAMPLE, lang), lang, photo: null };
}
