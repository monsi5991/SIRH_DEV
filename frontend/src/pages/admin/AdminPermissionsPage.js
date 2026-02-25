import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

const roles = [
  { role: "RH", access: "Administration complète + analytics" },
  { role: "Manager", access: "Espace manager + validations équipe" },
  { role: "Employé", access: "Self-service + documents personnels" },
];

export default function AdminPermissionsPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Matrice des permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {roles.map((item) => (
              <div key={item.role} className="border rounded-lg p-3">
                <div className="font-medium text-gray-900">{item.role}</div>
                <div className="text-sm text-gray-600">{item.access}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
