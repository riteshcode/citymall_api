/**
 * Minimal CSV writer (RFC 4180 quoting). Parsing is done with `csv-parse` — see product-bulk.service.js.
 * The output starts with a UTF-8 BOM so Excel opens Hindi text correctly instead of as mojibake.
 */
const needsQuotes = /[",\r\n]/;

function cell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return needsQuotes.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns, rows) {
  const lines = [columns.join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
