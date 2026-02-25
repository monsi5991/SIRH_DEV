import React, { useEffect, useMemo, useState } from "react";
import { get } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function EmployeeDashboardPage() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    get("/dashboard/summary").then(setSummary).catch(() => setSummary(null));
  }, []);

  const cards = useMemo(() => [
    { label: "Événements à venir", value: summary?.upcomingEvents?.length ?? "—" },
    { label: "Activités récentes", value: summary?.recentExpenses?.length ?? "—" },
    { label: "Validations globales", value: summary?.pendingValidations?.total ?? "—" },
  ], [summary]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Mon espace employé</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader><CardTitle className="text-base">{card.label}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{card.value}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
