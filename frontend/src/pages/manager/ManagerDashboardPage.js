import React, { useEffect, useState } from "react";
import { get } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function ManagerDashboardPage() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    get("/dashboard/summary").then(setSummary).catch(() => setSummary(null));
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Espace Manager</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Congés à valider</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{summary?.pendingValidations?.leaves ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Feuilles de temps</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{summary?.pendingValidations?.timesheets ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Dépenses à valider</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{summary?.pendingValidations?.expenses ?? "—"}</CardContent>
        </Card>
      </div>
    </div>
  );
}
