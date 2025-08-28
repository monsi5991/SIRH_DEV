import React, { useEffect, useState } from "react";
import { get } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import dayjs from "dayjs";

export default function SlipsPage() {
  const [period, setPeriod] = useState(dayjs().format("YYYY-MM"));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await get(`/payroll/slips?period=${period}`);
      setItems(r.items || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [period]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bulletins</h1>
        <div className="flex gap-2">
          <input type="month" className="border rounded-lg px-3 py-2" value={period} onChange={e => setPeriod(e.target.value)} />
          <Button variant="outline" onClick={load}>Rafraîchir</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Fichiers générés</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-gray-500">Chargement…</p> : (
            <ul className="space-y-2">
              {items.map((i, idx) => (
                <li key={idx} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="text-sm">Période: <b>{i.period}</b></div>
                    <div className="text-xs text-gray-500">Généré le {new Date(i.createdAt).toLocaleString()}</div>
                  </div>
                  <a className="text-blue-600 underline" href={i.url} target="_blank" rel="noreferrer">Télécharger</a>
                </li>
              ))}
              {!items.length && <p className="text-sm text-gray-500">Aucun bulletin trouvé.</p>}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
