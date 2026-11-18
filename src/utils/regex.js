/** Escapes user input so it can be embedded in a RegExp as a literal string. */
export const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive "contains" matcher built from raw user input. */
export const containsRegex = (text) => new RegExp(escapeRegex(text), 'i');
