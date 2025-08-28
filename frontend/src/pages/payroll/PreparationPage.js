import React, { useEffect, useMemo, useState } from "react";
import { get, post } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { Calculator, TrendingUp, ShieldAlert, FilePlus2, Layers, List } from "lucide-react";

export default function PreparationPayrollPage() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0,7));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [batching, setBatching] = useState(false);
  const [detail, setDetail] = useState(null); // {emp, lines}

  const load = async () => {
    setLoading(true);
    try {
      const r = await get(`/payroll/preview?period=${period}`);
      setData(r);
    } catch (e) {
      toast.error(e?.message || "Erreur chargement paie");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period]);

  const kpis = useMemo(() => {
    if (!data?.kpis) return [];
    return [
      { title: "Employés", value: data.kpis.employees, icon: Calculator },
      { title: "Masse salariale (brut)", value: new Intl.NumberFormat('fr-FR').format(data.kpis.totalGross), icon: TrendingUp },
      { title: "Net total", value: new Intl.NumberFormat('fr-FR').format(data.kpis.totalNet), icon: TrendingUp },
      { title: "Coût employeur total", value: new Intl.NumberFormat('fr-FR').format(data.kpis.totalEmployerCost), icon: ShieldAlert },
    ];
  }, [data]);

  const generate = async (empId) => {
    try {
      const r = await post(`/payroll/payslip/${empId}/generate`, { period });
      toast.success("Bulletin généré");
      if (r?.fileUrl) window.open(r.fileUrl, "_blank");
    } catch (e) {
      toast.error(e?.message || "Échec génération");
    }
  };

  const generateAll = async () => {
    setBatching(true);
    try {
      const r = await post(`/payroll/generate-all`, { period });
      toast.success(`Bulletins générés : ${r.count}`);
    } catch (e) {
      toast.error(e?.message || "Échec batch");
    } finally {
      setBatching(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n ?? 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Préparation paie</h1>
        <div className="flex items-center gap-2">
          <input type="month" className="border rounded-lg px-3 py-2" value={period} onChange={e => setPeriod(e.target.value)} />
          <Button variant="outline" onClick={load}>Recalculer</Button>
          <Button onClick={generateAll} disabled={batching} className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Générer tous
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <Card key={i}><CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">{k.title}</div>
                  <div className="text-2xl font-bold text-gray-900">{k.value}</div>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </CardContent></Card>
          );
        })}
      </div>

      {/* Tableau employés */}
      <Card>
        <CardHeader>
          <CardTitle>Variables & résultats – {period}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Calcul en cours…</p>
          ) : !data?.items?.length ? (
            <p>Aucune donnée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 border">Salarié</th>
                    <th className="p-2 border">Brut</th>
                    <th className="p-2 border">IR</th>
                    <th className="p-2 border">TRIMF</th>
                    <th className="p-2 border">Net</th>
                    <th className="p-2 border">Charges employeur</th>
                    <th className="p-2 border">Coût employeur</th>
                    <th className="p-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => {
                    const emp = r.employee ?? {};
                    const chargesEmp = (r.ipres_emp ?? 0) + (r.ipres_cadre_emp ?? 0) + (r.css_pf_emp ?? 0) + (r.css_at_emp ?? 0) + (r.cfce ?? 0);
                    return (
                      <tr key={r.employeeId} className="hover:bg-gray-50">
                        <td className="p-2 border">
                          <div className="font-medium">
                            {(emp.firstName ?? '—')}{' '}{emp.lastName ?? ''}
                          </div>
                          <div className="text-xs text-gray-500">
                            {emp.email ?? '—'}
                          </div>
                        </td>
                        <td className="p-2 border text-right">{fmt(r.brut)}</td>
                        <td className="p-2 border text-right">{fmt(r.ir)}</td>
                        <td className="p-2 border text-right">{fmt(r.trimf)}</td>
                        <td className="p-2 border text-right font-semibold">{fmt(r.net)}</td>
                        <td className="p-2 border text-right">{fmt(chargesEmp)}</td>
                        <td className="p-2 border text-right font-medium">{fmt(r.coutEmployeur)}</td>
                        <td className="p-2 border">
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => setDetail({ emp, lines: r.lines || [] })} className="flex items-center gap-1">
                              <List className="w-4 h-4" /> Lignes
                            </Button>
                            {r.employeeId ? (
                              <Button size="sm" onClick={() => generate(r.employeeId)} className="flex items-center gap-1">
                                <FilePlus2 className="w-4 h-4" /> Bulletin
                              </Button>
                            ) : (
                              <Badge variant="secondary">—</Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer / Modal simple pour les lignes */}
      {detail && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50" onClick={() => setDetail(null)}>
          <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-lg p-4" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Détail – {detail.emp?.firstName} {detail.emp?.lastName}</h3>
              <Button variant="ghost" onClick={() => setDetail(null)}>Fermer</Button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Nature</th>
                    <th className="p-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.lines || []).map((l, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2">{l.label}</td>
                      <td className="p-2 text-right">{fmt(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
