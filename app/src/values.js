/**
 * Turning what someone typed into what a design draws.
 *
 * Designs ask for {{dateLong}} and {{timeText}}; the editor collects a date
 * and a time. Everything else a design asks for is typed directly, which is
 * why there is no translation layer here and no language setting: whatever a
 * family writes is what appears, in whatever script they write it.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Spelled out rather than left to Intl, so the invite reads identically on
 * every phone. Old Android builds disagree about month names.
 */
export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return '';
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[day]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

/** "19:00" -> "7:00 PM" */
export function formatTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isNaN(h)) return '';
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

/** Add the computed slots to what the family typed. */
export function deriveSlots(entered) {
  return {
    ...entered,
    dateLong: formatDate(entered.date),
    timeText: formatTime(entered.time),
  };
}

/** The complete values object the renderer wants. */
export function toValues(entered, photos = {}) {
  return { slots: deriveSlots(entered), photos };
}
