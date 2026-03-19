// frontend/src/pages/employee/MyPayslipsPage.js
import React, { useEffect, useState } from "react";
import { get } from "../../lib/api";
import { openSecureFileUrl } from "../../lib/secureFiles";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import usePageMeta from "../../hooks/usePageMeta";

export default function MyPayslipsPage() {
  usePageMeta("Mes bulletins de paie", "Consultez vos bulletins publiés et votre aperçu de paie sur la période choisie.");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [noEmployee, setNoEmployee] = useState(false);

  const load = async () => {
    setLoading(true);
    setNoEmployee(false);
    try {
      const [mine, prev] = await Promise.allSettled([
        get(`/payroll/my/slips?period=${period}`),
        get(`/payroll/my/preview?period=${period}`)
      ]);

      if (mine.status === "fulfilled") {
        setItems(mine.value?.items || []);
      } else {
        const code = mine.reason?.error || mine.reason?.code || mine.reason?.message;
        if (code === "employee_not_found") setNoEmployee(true);
        setItems([]);
      }

      if (prev.status === "fulfilled") {
        setPreview(prev.value || null);
      } else {
        const code = prev.reason?.error || prev.reason?.code || prev.reason?.message;
        if (code === "employee_not_found") setNoEmployee(true);
        setPreview(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const fmt = (n) => new Intl.NumberFormat("fr-FR").format(n ?? 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes bulletins</h1>
        <div className="flex gap-2">
          <input
            type="month"
            className="border rounded-lg px-3 py-2"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
          <Button variant="outline" onClick={load}>Rafraîchir</Button>
        </div>
      </div>

      {noEmployee && (
        <Card>
          <CardHeader>
            <CardTitle>Profil employé introuvable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700">
            Votre compte n’est pas encore lié à un profil employé. Contactez les RH pour lier votre
            profil (email identique) ou réessayez plus tard.
          </CardContent>
        </Card>
      )}

      {!noEmployee && preview?.result && (
        <Card>
          <CardHeader>
            <CardTitle>Aperçu {period}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-gray-500">Brut</div>
                <div className="font-semibold">
                  {fmt(preview.result.gross)} {preview.result.currency}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Net</div>
                <div className="font-semibold">
                  {fmt(preview.result.net)} {preview.result.currency}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Cotisations sociales</div>
                <div className="font-semibold">
                  {fmt((preview.result.ipres ?? 0) + (preview.result.css ?? 0))} {preview.result.currency}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Heures sup (montant)</div>
                <div className="font-semibold">
                  {fmt(preview.result.overtimeXof ?? 0)} {preview.result.currency}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Mes fichiers publiés</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : (
            <ul className="space-y-2">
              {items.map((i, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div>
                    <div className="text-sm">
                      Période: <b>{i.period}</b>
                    </div>
                    <div className="text-xs text-gray-500">
                      Publié le {new Date(i.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-blue-600 underline"
                    onClick={() => openSecureFileUrl(i.url)}
                  >
                    Télécharger
                  </button>
                </li>
              ))}
              {!items.length && !loading && !noEmployee && (
                <p className="text-sm text-gray-500">
                  Aucun bulletin publié pour {period}.
                </p>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
