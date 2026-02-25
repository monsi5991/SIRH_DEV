import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function AdminStructurePage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Structure organisationnelle</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>Gérez les entités, départements, sites et rattachements managers.</p>
          <p>Recommandation: ajouter une vue hiérarchique + import CSV pour onboarding rapide.</p>
        </CardContent>
      </Card>
    </div>
  );
}
