import React, { useEffect, useMemo, useState } from "react";
import { get, post, del as delReq } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import EventFormDialog from "../../components/operations/EventFormDialog";
import { kpiStart, kpiSuccess, kpiError } from "../../lib/kpiTracker";

function eventTypeLabel(type) {
  if (type === "meeting") return "Reunion";
  if (type === "training") return "Formation";
  if (type === "deadline") return "Echeance";
  return "Autre";
}

export default function PlanningPage() {
  const { formatDate } = useApp();
  const [events, setEvents] = useState([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [openForm, setOpenForm] = useState(false);

  const load = async () => {
    const qs = new URLSearchParams();
    if (typeFilter) qs.set("type", typeFilter);
    const data = await get(`/operations/events?${qs.toString()}`);
    setEvents(data.events || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const signalSidebar = () => {
    window.dispatchEvent(new CustomEvent("app:counters:refresh"));
  };

  const addEvent = async (payload) => {
    const t0 = kpiStart("planning_events");
    try {
      await post("/operations/events", payload);
      const required = [payload.title, payload.date, payload.type];
      const filled = required.filter(Boolean).length / required.length;
      kpiSuccess("planning_events", t0, filled);
    } catch (e) {
      kpiError("planning_events");
      throw e;
    }
    await load();
    signalSidebar();
  };

  const remove = async (id) => {
    if (!window.confirm("Supprimer cet événement ?")) return;
    await delReq(`/operations/events/${id}`);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    signalSidebar();
  };

  const filtered = useMemo(() => events, [events]);

  return (
    <div className="p-6 space-y-6 table-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planning</h1>
          <p className="text-sm text-gray-600">Centralisez les reunions RH, formations, echeances et temps forts multisites.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="border rounded px-2 py-1" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Tous types</option>
            <option value="meeting">Reunion</option>
            <option value="training">Formation</option>
            <option value="deadline">Echeance</option>
            <option value="other">Autre</option>
          </select>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpenForm(true)}>
            <Plus className="w-4 h-4 mr-2" /> Ajouter
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" /> Événements</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length ? (
            <div className="space-y-3">
              {filtered.map((ev) => (
                <div key={ev.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{ev.title}</div>
                    <div className="text-xs text-gray-500">
                      {formatDate(ev.date)} {ev.time ? `• ${ev.time}` : ""} • {ev.location || "—"}
                    </div>
                    <div className="text-xs text-gray-500">{ev.description || ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{eventTypeLabel(ev.type)}</Badge>
                    <Button size="sm" variant="outline" onClick={() => remove(ev.id)} className="text-gray-600"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">Aucun evenement planifie.</p>}
        </CardContent>
      </Card>

      <EventFormDialog open={openForm} onClose={() => setOpenForm(false)} onSubmit={addEvent} />
    </div>
  );
}
