// src/utils/csv.js
export function exportCSV(filename, rows) {
  if (!Array.isArray(rows) || !rows.length) return;

  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    if (val == null) return "";
    const s = String(val);
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csv =
    [headers.join(",")]
      .concat(rows.map(row => headers.map(h => escape(row[h])).join(",")))
      .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
