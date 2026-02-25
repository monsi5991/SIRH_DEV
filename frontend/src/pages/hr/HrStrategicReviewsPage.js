import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function HrStrategicReviewsPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Revues stratégiques RH</h1>
      <Card>
        <CardHeader>
          <CardTitle>Comité RH</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>• Succession planning postes critiques</p>
          <p>• Revue rémunération et équité interne</p>
          <p>• Priorisation des initiatives People</p>
        </CardContent>
      </Card>
    </div>
  );
}
