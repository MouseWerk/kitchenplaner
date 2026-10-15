/**
 * The provider's details for the legal notice („Impressum“) and the privacy policy. The owner fills
 * them in; nothing here may be guessed. Until every required field is set, the two pages show a
 * visible draft notice and are kept out of search engines, and the deploy workflow does not publish
 * the site (scripts/legal-ready.mjs). Optional fields stay null when they do not apply.
 *
 * TODO(owner): fill in the MouseWerk details below, set `updated` to the day of the change, review
 * the privacy text in src/i18n/de.mjs and en.mjs (legal.privacy) and, once the app checks for
 * updates itself, add a paragraph on that (which address it contacts, what it sends).
 */
export const LEGAL = {
  /** Name of the provider (company with legal form, or the person). Required. */
  name: null,
  /** Street and number. Required. */
  street: null,
  /** Postcode and town. Required. */
  city: null,
  /** Country. Required. */
  country: null,
  /** Email address for contact. Required. */
  email: null,
  /** Phone number, or null. */
  phone: null,
  /** Who represents the company (managing director), or null for a person. */
  represented: null,
  /** Register court and number, or null. */
  register: null,
  /** VAT ID, or null. */
  vat: null,
  /** Responsible for the content according to § 18 (2) MStV: name and address. Required. */
  responsible: null,
  /** Date of the last change of the legal pages, YYYY-MM-DD. Required. */
  updated: null,
};

export const REQUIRED = /** @type {const} */ (['name', 'street', 'city', 'country', 'email', 'responsible', 'updated']);

/** The required fields that are still missing. */
export const missingLegal = () => REQUIRED.filter((k) => !LEGAL[k]);
