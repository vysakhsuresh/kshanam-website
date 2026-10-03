/**
 * The design catalogue.
 *
 * A design is a JSON file and an entry here. Nothing about adding one touches
 * the renderer, which is the whole point of the template format.
 */
import kasavuGold from './kasavu-gold.json';

/** Designs that render today. */
export const TEMPLATES = [kasavuGold];

/**
 * Designs drawn in the planning mockups that are not built yet. They are
 * listed so the gallery shows the range honestly, and marked so nobody taps
 * into an editor that cannot render them.
 */
export const PLANNED = [
  { id: 'nilavilakku', name: 'Nilavilakku', tagline: { en: 'Traditional, Malayalam', ml: 'പരമ്പരാഗതം, മലയാളം' },
    occasions: ['wedding'], swatch: { bg: '#6E1423', ink: '#FFFFFF', accent: '#F2C14E' } },
  { id: 'lily-and-bells', name: 'Lily and Bells', tagline: { en: 'Christian, English', ml: 'ക്രിസ്ത്യൻ, ഇംഗ്ലീഷ്' },
    occasions: ['wedding'], swatch: { bg: '#EEF2F6', ink: '#23395B', accent: '#3D5A80' } },
  { id: 'crescent-gold', name: 'Crescent Gold', tagline: { en: 'Nikah, English', ml: 'നിക്കാഹ്, ഇംഗ്ലീഷ്' },
    occasions: ['wedding'], swatch: { bg: '#0F4D3A', ink: '#FFFFFF', accent: '#E3B341' } },
];

export const byId = (id) => TEMPLATES.find((t) => t.id === id) || null;

export const forOccasion = (occasion) =>
  TEMPLATES.filter((t) => !occasion || t.occasions.includes(occasion));

export const plannedForOccasion = (occasion) =>
  PLANNED.filter((t) => !occasion || t.occasions.includes(occasion));
