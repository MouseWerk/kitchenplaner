/**
 * The provider's details for the legal notice („Impressum“) and the privacy policy. The owner fills
 * them in; nothing here may be guessed. Until every required field is set, the two pages show a
 * visible draft notice and are kept out of search engines, and the deploy workflow does not publish
 * the site (scripts/legal-ready.mjs). Optional fields stay null when they do not apply.
 *
 * The details are the same as on the Arcalo website (MouseWerk/annaloweb, src/data/company.ts):
 * both apps are published by MouseWerk (owner's decision, 2026-10-15). Change them in both places.
 */
export const LEGAL = {
  /** Name of the provider (company with legal form, or the person). Required. */
  name: "Mousewerk, Inhaber Maurice Kleindienst (Einzelunternehmen)",
  /** Street and number. Required. */
  street: "Oberzwehrener Str. 62b",
  /** Postcode and town. Required. */
  city: "34132 Kassel",
  /** Country. Required. */
  country: "Deutschland",
  /** Email address for contact. Required. */
  email: "support@mousewerk.de",
  /** Phone number, or null. */
  phone: "+49 151 04053172",
  /** Who represents the company (managing director), or null for a person. */
  represented: null,
  /** Register court and number, or null (a sole proprietorship has none). */
  register: null,
  /** VAT ID, or null. */
  vat: "DE463851440",
  /** Responsible for the content according to § 18 (2) MStV: name and address. Required. */
  responsible: "Maurice Kleindienst, Oberzwehrener Str. 62b, 34132 Kassel",
  /** Date of the last change of the legal pages, YYYY-MM-DD. Required. */
  updated: "2026-10-15",
};

export const REQUIRED = /** @type {const} */ (['name', 'street', 'city', 'country', 'email', 'responsible', 'updated']);

/** The required fields that are still missing. */
export const missingLegal = () => REQUIRED.filter((k) => !LEGAL[k]);
