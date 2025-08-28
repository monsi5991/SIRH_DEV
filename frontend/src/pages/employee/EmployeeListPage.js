// frontend/src/pages/employee/EmployeeListPage.js
import React, { useEffect, useState } from "react";
import { get } from "../../lib/api";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function EmployeeListPage() {
  const [items, setItems] = useState([]);

  const load = async () => {
    try {
      const data = await get("/employees");
      setItems(data || []);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const f = () => load();
    window.addEventListener("employees:changed", f);
    return () => window.removeEventListener("employees:changed", f);
  }, []);

  return (
    <div className="p-6">
      <Card>
        <CardHeader><CardTitle>Employés</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 border">Nom</th>
                  <th className="p-2 border">Email</th>
                  <th className="p-2 border">Poste</th>
                  <th className="p-2 border text-right">Salaire de base</th>
                  <th className="p-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="p-2 border">{e.firstName} {e.lastName}</td>
                    <td className="p-2 border">{e.email}</td>
                    <td className="p-2 border">{e.position || "—"}</td>
                    <td className="p-2 border text-right">
                      {e.baseSalary
                        ? new Intl.NumberFormat('fr-FR').format(e.baseSalary)
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="p-2 border">
                      <Link className="text-blue-600 underline" to={`/employee/${e.id}/edit`}>Éditer</Link>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr><td className="p-3 text-gray-500" colSpan={5}>Aucun employé.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
