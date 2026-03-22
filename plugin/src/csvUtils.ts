// ── csvUtils.ts ───────────────────────────────────────────────────────────────
//
// Shared CSV parsing and serialisation utilities.
//
// This file is the canonical source of truth. Each plugin keeps its own copy
// at src/csvUtils.ts to avoid cross-repo dependencies. When changing this file,
// copy the updated version into each plugin.
//
// No Obsidian dependencies — fully unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

// ── Row splitter ──────────────────────────────────────────────────────────────
// RFC-4180 quoting: fields may be wrapped in double-quotes.
// "" inside a quoted field represents a literal double-quote character.

export function splitCsvRow(row: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') { cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

// ── Full CSV parser ───────────────────────────────────────────────────────────
// Returns an array of row objects keyed by lowercased, trimmed header names.
// Cell values are trimmed. Handles \r\n, \r, and \n line endings.
// Returns [] if the input has fewer than two lines.

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvRow(lines[0]).map(h => h.toLowerCase().trim());
  return lines.slice(1).map(line => {
    const values = splitCsvRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim(); });
    return row;
  });
}

// ── Serialiser ────────────────────────────────────────────────────────────────
// Builds a CSV string from a header array and data rows.
//
// Each row is an array of (string | string[]) values in the same order as
// headers. string[] values are pipe-joined before quoting — this is the
// canonical encoding for list-type fields across all plugins.
//
// A cell is quoted when it contains a comma, double-quote, or newline.
// Output ends with a trailing newline.

function quoteCell(value: string): string {
  if (/[",\n\r]/.test(value)) return '"' + value.replace(/"/g, '""') + '"';
  return value;
}

export function joinMultiValue(values: string[]): string {
  return values.join('|');
}

export function serializeCSV(
  headers: string[],
  rows: (string | string[])[][],
): string {
  const lines: string[] = [headers.map(quoteCell).join(',')];
  for (const row of rows) {
    lines.push(
      row
        .map(cell => quoteCell(Array.isArray(cell) ? joinMultiValue(cell) : cell))
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}
