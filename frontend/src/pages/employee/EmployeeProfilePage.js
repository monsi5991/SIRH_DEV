import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function EmployeeProfilePage() {
  const { user } = useAuth();

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Mon profil RH</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700">
          <p><span className="font-medium">Nom:</span> {user?.firstName} {user?.lastName}</p>
          <p><span className="font-medium">Email:</span> {user?.email}</p>
          <p><span className="font-medium">Rôles:</span> {(user?.roles || []).join(", ") || "—"}</p>
          <p><span className="font-medium">Tenant:</span> {user?.tenant?.name || "—"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
