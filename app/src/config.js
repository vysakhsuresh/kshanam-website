/**
 * The handful of things only the owner can decide. Everything is empty or a
 * placeholder on purpose: a guessed value ships as if it were right.
 */

export const BRAND = {
  name: 'Festa',
  tagline: 'Invitation videos for every celebration',
};

/** The live domain. Set it once the domain is registered. */
export const SITE_DOMAIN = '[YOUR DOMAIN]';

/**
 * Where "Buy us a coffee" points. Empty hides the button entirely rather than
 * linking somewhere broken. Any of Buy Me a Coffee, Ko-fi or a UPI link works.
 */
export const SUPPORT_URL = '';

/**
 * Where "Something's wrong" sends feedback. Empty means the help page says
 * plainly that feedback is not switched on yet. CLAUDE.md says to ask before
 * adding any third-party form service, so none has been added.
 */
export const FEEDBACK_EMAIL = '';

/**
 * AdSense client id. Ads are allowed on browsing pages only — never the
 * editor, never the render screen, never beside download or share. Empty
 * means no ad code is loaded at all.
 */
export const ADSENSE_CLIENT = '';
