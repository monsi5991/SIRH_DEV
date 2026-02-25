import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

const requests = [
  { label: "Congés", path: "/operations/leaves", status: "Disponible" },
  { label: "Feuilles de temps", path: "/operations/time", status: "Disponible" },
  { label: "Notes de frais", path: "/operations/expenses", status: "Disponible" },
];

export default function EmployeeRequestsPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Mes demandes RH</h1>
      <Card>
        <CardHeader>
          <CardTitle>Demandes self-service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.map((item) => (
            <div key={item.label} className="border rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">{item.label}</div>
                <div className="text-xs text-gray-500">Parcours guidé employé</div>
              </div>
              <Badge variant="outline">{item.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
