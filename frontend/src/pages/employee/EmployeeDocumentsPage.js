import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function EmployeeDocumentsPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Mes documents</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coffre documentaire employé</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>• Contrat et avenants</p>
          <p>• Attestations RH</p>
          <p>• Documents à signer / historiques de signature</p>
        </CardContent>
      </Card>
    </div>
  );
}
