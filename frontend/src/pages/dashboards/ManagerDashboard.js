import React, { useEffect, useState } from "react";
import { get } from "../../lib/api";

export default function ManagerDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { get("/dashboard/stats").then(setStats).catch(()=>{}); }, []);
  if (!stats) return <div className="p-6">Chargement…</div>;
  return (
    <div className="p-6">
      <h3 className="text-lg font-bold mb-2">Dashboard Manager</h3>
      <p>Validations en attente : {stats.pendingValidations}</p>
    </div>
  );
}
