import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

const reports = [
  { name: "Absentéisme mensuel", owner: "People Ops", frequency: "Mensuel", status: "Actif" },
  { name: "Cycle de validation congés", owner: "RH", frequency: "Hebdomadaire", status: "Actif" },
  { name: "Conformité documentaire", owner: "Compliance", frequency: "Mensuel", status: "Actif" },
  { name: "Budget formation vs réalisé", owner: "L&D", frequency: "Trimestriel", status: "À paramétrer" },
];

export default function AnalyticsReportsPage() {
  const activeCount = useMemo(() => reports.filter((r) => r.status === "Actif").length, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Rapports RH</h1>
        <Badge variant="secondary">{activeCount}/{reports.length} actifs</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bibliothèque de rapports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.name} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{report.name}</div>
                  <div className="text-xs text-gray-500">Owner: {report.owner} • Fréquence: {report.frequency}</div>
                </div>
                <Badge variant={report.status === "Actif" ? "outline" : "secondary"}>{report.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
