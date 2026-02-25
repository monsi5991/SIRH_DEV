import React, { useEffect, useMemo, useState } from "react";
import { get } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function TeamApprovalsPage() {
  const [leaves, setLeaves] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    Promise.all([
      get("/operations/leaves").then((d) => setLeaves(d.leaves || [])).catch(() => undefined),
      get("/operations/timesheets").then((d) => setTimesheets(d.timesheets || [])).catch(() => undefined),
      get("/operations/expenses").then((d) => setExpenses(d.expenses || [])).catch(() => undefined),
    ]);
  }, []);

  const counters = useMemo(() => ({
    leaves: leaves.filter((l) => l.status === "Pending").length,
    timesheets: timesheets.filter((t) => t.status === "Submitted").length,
    expenses: expenses.filter((e) => e.status === "Submitted").length,
  }), [leaves, timesheets, expenses]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Validations équipe</h1>
      <Card>
        <CardHeader>
          <CardTitle>Backlog à traiter</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-3"><div className="text-xs text-gray-500">Congés</div><div className="text-xl font-bold">{counters.leaves}</div></div>
          <div className="border rounded-lg p-3"><div className="text-xs text-gray-500">Temps</div><div className="text-xl font-bold">{counters.timesheets}</div></div>
          <div className="border rounded-lg p-3"><div className="text-xs text-gray-500">Dépenses</div><div className="text-xl font-bold">{counters.expenses}</div></div>
        </CardContent>
      </Card>
    </div>
  );
}
