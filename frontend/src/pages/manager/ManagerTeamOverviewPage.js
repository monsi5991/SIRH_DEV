import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

const focusBlocks = [
  "Charge de travail hebdomadaire",
  "Absences prévues sur 30 jours",
  "Risque de surcharge par collaborateur",
  "Compétences critiques manquantes",
];

export default function ManagerTeamOverviewPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Vue équipe manager</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {focusBlocks.map((block) => (
          <Card key={block}>
            <CardHeader>
              <CardTitle className="text-base">{block}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Indicateur prêt pour raccordement aux données équipe (scope manager uniquement).
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
