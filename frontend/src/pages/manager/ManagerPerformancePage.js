import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function ManagerPerformancePage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Performance équipe</h1>
      <Card>
        <CardHeader>
          <CardTitle>Suivi performance manager</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>• Objectifs en retard vs à l&apos;heure</p>
          <p>• Entretiens 1:1 à programmer</p>
          <p>• Collaborateurs à fort potentiel / à accompagner</p>
        </CardContent>
      </Card>
    </div>
  );
}
