import React, { useEffect, useState } from "react";
import { get } from "../../lib/api";

export default function DirectoryPage() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { users } = await get("/people/directory");
        setRows(users || []);
      } catch (e) {
        setErr(e.message || "Erreur annuaire");
      }
    })();
  }, []);

  if (err) return <p className="p-6 text-red-600">{err}</p>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Annuaire</h2>
      <div className="overflow-auto rounded border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Rôles</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.email}</td>
                <td className="p-3">{(u.roles || []).join(", ")}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td className="p-3 text-gray-500" colSpan={2}>Aucun utilisateur</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
