/**
 * The design catalogue.
 *
 * Every *.json in this folder that has scenes is a design. Nothing has to be
 * registered by hand, so adding one really is adding a file — which is the
 * whole promise of the template format.
 */
import FIELDSETS from './fieldsets.json';
import { CATEGORIES } from './categories.js';

const modules = import.meta.glob('./*.json', { eager: true });

export const TEMPLATES = Object.entries(modules)
  .map(([, mod]) => mod.default || mod)
  .filter((t) => t && Array.isArray(t.scenes) && t.id)
  .sort((a, b) => a.name.localeCompare(b.name));

export const byId = (id) => TEMPLATES.find((t) => t.id === id) || null;

export const forCategory = (category) =>
  (!category || category === 'all'
    ? TEMPLATES
    : TEMPLATES.filter((t) => (t.categories || []).includes(category)));

/** Categories that actually have designs, in the order they are declared. */
export const usedCategories = () =>
  CATEGORIES.filter((c) => forCategory(c.id).length > 0);

/**
 * The editable fields for a design: its fieldset, with its own defaults
 * merged in. The editor renders this; it knows nothing about any one design.
 */
export function fieldsFor(template) {
  const set = FIELDSETS[template.fieldset] || FIELDSETS.couple;
  return set.map((field) => ({
    ...field,
    default: template.defaults && template.defaults[field.key] != null
      ? template.defaults[field.key]
      : field.default,
  }));
}

/** Starting values for a design, for previews and for a fresh editor. */
export function defaultValuesFor(template) {
  const out = {};
  for (const field of fieldsFor(template)) out[field.key] = field.default != null ? field.default : '';
  return out;
}

export { CATEGORIES };
