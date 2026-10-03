/**
 * What people are celebrating.
 *
 * Browsing starts here rather than with a wall of designs: somebody arrives
 * knowing they have a wedding, not knowing they want "Ivory Deco".
 */
export const CATEGORIES = [
  { id: 'wedding',       name: 'Wedding',            motif: 'rings',           blurb: 'Every tradition, every faith.' },
  { id: 'engagement',    name: 'Engagement',         motif: 'heart',           blurb: 'The yes before the day.' },
  { id: 'save-the-date',    name: 'Save the Date',   motif: 'diamond',         blurb: 'Get the date in their calendar early.' },
  { id: 'reception',     name: 'Reception',          motif: 'sparkle',         blurb: 'The party after the vows.' },
  { id: 'birthday',      name: 'Birthday',           motif: 'cake',            blurb: 'From the first to the eightieth.' },
  { id: 'first-birthday',name: 'First Birthday',     motif: 'balloon-cluster', blurb: 'One whole year.' },
  { id: 'baby',          name: 'Baby & Naming',      motif: 'rattle',          blurb: 'Naming days, baptisms, showers.' },
  { id: 'anniversary',   name: 'Anniversary',        motif: 'laurel',          blurb: 'Silver, golden, and every year between.' },
  { id: 'housewarming',  name: 'Housewarming',       motif: 'house',           blurb: 'A new door, open to everyone.' },
  { id: 'graduation',    name: 'Graduation',         motif: 'graduation-cap',  blurb: 'Years of work, one afternoon.' },
  { id: 'farewell',      name: 'Retirement & Farewell', motif: 'dove',         blurb: 'Send them off properly.' },
  { id: 'festival',      name: 'Festivals',          motif: 'diya',            blurb: 'Diwali, Eid, Christmas, New Year.' },
  { id: 'corporate',     name: 'Openings & Corporate', motif: 'starburst',     blurb: 'Launches, openings, company evenings.' },
];

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || null;
export const categoryName = (id) => (categoryById(id) || {}).name || id;
