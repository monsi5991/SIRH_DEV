import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

export default function AdminIntegrationsPage() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Intégrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between border rounded-lg p-3">
            <span>Keycloak SSO</span>
            <Badge variant="outline">Connecté</Badge>
          </div>
          <div className="flex items-center justify-between border rounded-lg p-3">
            <span>Export paie (Sage/Cegid)</span>
            <Badge variant="secondary">À configurer</Badge>
          </div>
          <div className="flex items-center justify-between border rounded-lg p-3">
            <span>Canal notifications (Email/Slack/WhatsApp)</span>
            <Badge variant="secondary">À configurer</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
