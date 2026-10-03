/**
 * The few things the owner has to decide. Everything here is deliberately
 * empty rather than guessed, because a wrong value ships as if it were right.
 */

/** The live domain, shown on the end card. CLAUDE.md: use the placeholder. */
export const SITE_DOMAIN = '[YOUR DOMAIN]';

/**
 * Where "Something's wrong" sends feedback.
 *
 * Empty on purpose: CLAUDE.md says to start with a mailto or a free form
 * service *the owner chooses*, and to ask before adding any third party. Put
 * an address here and the feedback box starts working; leave it empty and the
 * screen says plainly that feedback is not switched on yet.
 */
export const FEEDBACK_EMAIL = '';

/**
 * AdSense client id. Ads are allowed on gallery and occasion pages only -
 * never the editor, never the rendering screen, never beside download or
 * share. Empty means no ad code is loaded at all.
 */
export const ADSENSE_CLIENT = '';
