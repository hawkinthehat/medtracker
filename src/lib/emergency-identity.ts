/**
 * Wallet / emergency ID — edit for your legal name and contacts.
 * Used by `/emergency` (digital medical ID).
 */
export const EMERGENCY_LEGAL_NAME = "Full legal name";

export type EmergencyContact = {
  relationship: string;
  name: string;
  phone: string;
};

/** ICE contacts shown on the emergency page and printout. */
export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { relationship: "Emergency contact", name: "Name", phone: "(000) 000-0000" },
  { relationship: "Alternate", name: "Name", phone: "(000) 000-0000" },
];
