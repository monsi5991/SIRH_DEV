import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function HrWorkforcePlanningPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Workforce Planning RH</h1>
      <Card>
        <CardHeader>
          <CardTitle>Planification des effectifs</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>• Besoins de recrutement par département</p>
          <p>• Projection headcount (M+1 / M+3 / M+6)</p>
          <p>• Risques turnover et plans de mitigation</p>
        </CardContent>
      </Card>
    </div>
  );
}
