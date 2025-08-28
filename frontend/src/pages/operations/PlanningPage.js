import React, { useEffect, useMemo, useState } from "react";
import { get, post, del as delReq } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { useApp } from "../../contexts/AppContext";

export default function PlanningPage() {
  const { formatDate } = useApp();
  const [events, setEvents] = useState([]);
  const [typeFilter, setTypeFilter] = useState("");

  const load = async () => {
    const qs = new URLSearchParams();

    // Par défaut: à venir uniquement
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    qs.append("from", `${yyyy}-${mm}-${dd}`);

    if (typeFilter) qs.append("type", typeFilter);

    const data = await get(`/operations/events?${qs.toString()}`);
    setEvents(data.events || data || []);
  };

  useEffect(() => { load().catch(() => {}); }, [typeFilter]);

  const signalSidebar = () => {
    // Notifie le Sidebar pour recomptage
    window.dispatchEvent(new CustomEvent("events:changed"));
    // Et, si tu veux aussi recalculer les autres badges:
    window.dispatchEvent(new CustomEvent("app:counters:refresh"));
  };

  const addEvent = async () => {
    const title = prompt("Titre", "Réunion équipe RH");
    if (!title) return;
    const date = prompt("Date (YYYY-MM-DD)", new Date(Date.now()+2*864e5).toISOString().slice(0,10));
    const time = prompt("Heure (HH:mm)", "10:00");
    const type = prompt("Type (meeting|training|deadline|other)", "meeting");
    const description = prompt("Description", "");
    const location = prompt("Lieu", "Salle 2");
    const attendees = prompt("Participants (emails séparés par ,)", "marie@acme.sn, amadou@acme.sn");
    await post("/operations/events", { title, date, time, type, description, location, attendees });
    await load();
    signalSidebar();
  };

  const remove = async (id) => {
    if (!window.confirm("Supprimer cet événement ?")) return;
    await delReq(`/operations/events/${id}`);
    setEvents(prev => prev.filter(e => e.id !== id));
    signalSidebar();
  };

  const grouped = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const day = new Date(ev.date).toISOString().slice(0,10);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(ev);
    }
    return [...map.entries()].sort(([a],[b]) => a.localeCompare(b));
  }, [events]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        {/* Titre cohérent avec le menu */}
        <h1 className="text-2xl font-bold text-gray-900">Événements</h1>
        <div className="flex items-center gap-2">
          <select className="border rounded px-2 py-1" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">Tous types</option>
            <option value="meeting">meeting</option>
            <option value="training">training</option>
            <option value="deadline">deadline</option>
            <option value="other">other</option>
          </select>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={addEvent}>
            <Plus className="w-4 h-4 mr-2" /> Ajouter
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Événements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {grouped.map(([day, items]) => (
            <div key={day} className="mb-6">
              <div className="text-sm font-semibold text-gray-700 mb-2">{day}</div>
              <div className="space-y-2">
                {items.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between p-3 rounded border hover:bg-gray-50">
                    <div>
                      <div className="font-medium text-gray-900">{ev.title}</div>
                      <div className="text-xs text-gray-500">
                        {ev.type} • {formatDate(ev.date)}{ev.time ? ` à ${ev.time}` : ""} • {ev.location || "—"}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => remove(ev.id)} className="text-gray-600">
                      <Trash2 className="w-4 h-4 mr-1" /> Suppr.
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!grouped.length && <div className="text-sm text-gray-500">Aucun événement à venir.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
