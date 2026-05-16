// Lightweight CSV parser (handles quoted fields)
export const parseCSV = (text: string): Record<string, string>[] => {
  const lines: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(cell); cell = ""; }
      else if (c === "\n") { cur.push(cell); lines.push(cur); cur = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || cur.length) { cur.push(cell); lines.push(cur); }
  if (lines.length === 0) return [];
  const headers = lines[0].map((h) => h.trim().toLowerCase());
  return lines.slice(1).filter((r) => r.some((c) => c.trim().length))
    .map((row) => Object.fromEntries(headers.map((h, i) => [h, (row[i] ?? "").trim()])));
};
