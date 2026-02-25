import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

const widgets = [
  "Headcount & mouvements",
  "Temps moyen de validation",
  "Répartition des congés",
  "Engagement formation",
];

export default function AnalyticsDashboardsPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Dashboards RH</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {widgets.map((w) => (
          <Card key={w}>
            <CardHeader>
              <CardTitle className="text-base">{w}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Ce widget est prêt pour raccordement API et filtres (entité, période, département).
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
