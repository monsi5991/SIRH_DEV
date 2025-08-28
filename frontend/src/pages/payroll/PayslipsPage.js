import React, { useEffect, useState } from "react";
import { get, post } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { Send, Download, MailPlus } from "lucide-react";

export default function PayslipsPage() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0,7));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await get(`/payroll/payslips?period=${period}`);
      setItems(r?.items || []);
    } catch (e) {
      toast.error(e?.message || "Erreur chargement bulletins");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [period]);

  const send = async () => {
    try {
      const r = await post(`/payroll/send-all`, { period });
      toast.success(`Envoi simulé : ${r.count} bulletin(s)`);
    } catch (e) {
      toast.error(e?.message || "Échec envoi");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Bulletins – {period}</h1>
        <div className="flex items-center gap-2">
          <input type="month" className="border rounded-lg px-3 py-2" value={period} onChange={e=>setPeriod(e.target.value)} />
          <Button variant="outline" onClick={load}>Rafraîchir</Button>
          <Button onClick={send} className="flex items-center gap-2">
            <MailPlus className="w-4 h-4" /> Envoyer tous (démo)
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Fichiers générés</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-gray-500">Chargement…</p>
          : items.length ? (
            <ul className="space-y-2">
              {items.map((f, i) => (
                <li key={i} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="font-medium">{f.file}</div>
                    <div className="text-xs text-gray-500">Publié le {new Date(f.createdAt).toLocaleString()}</div>
                  </div>
                  <a className="flex items-center gap-1 text-blue-600 underline" href={f.url} target="_blank" rel="noreferrer">
                    <Download className="w-4 h-4" /> Ouvrir
                  </a>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-500">Aucun bulletin généré pour {period}. Va dans “Préparation paie”.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
