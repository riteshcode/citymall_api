/**
 * All money is handled as integer paise internally — never floats.
 * These helpers exist so rounding rules live in exactly one place.
 */

export const rupeesToPaise = (rupees) => Math.round(rupees * 100);

export const paiseToRupees = (paise) => Math.round(paise) / 100;

export const clampNonNegative = (paise) => Math.max(0, Math.round(paise));

export const percentOf = (paise, percent) => Math.round((paise * percent) / 100);
