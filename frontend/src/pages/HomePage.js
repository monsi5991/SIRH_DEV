// src/pages/HomePage.js
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { get } from '../lib/api';
import { Users, Calendar, Receipt, Clock, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const MAX_LIST_ITEMS = 6;

const HomePage = () => {
  const { formatDate } = useApp();
  const { user } = useAuth();

  const [summary, setSummary] = useState(null);
  const [month, setMonth] = useState({
    attendanceRate: null,
    approvedLeaves: 0,
    totalExpensesXof: 0,
    pendingValidationsMonth: { total: 0, leaves: 0, timesheets: 0, expenses: 0 },
  });
  const [activities, setActivities] = useState([]);
  const [events, setEvents] = useState([]);
  const [err, setErr] = useState("");

  const tenantName =
    user?.tenant?.name
    || (user?.email ? user.email.split("@")[1] : null)
    || "Mon espace";

  useEffect(() => {
    (async () => {
      try {
        const s = await get('/dashboard/summary');
        setSummary(s);
      } catch (e) { setErr(e.message || "Erreur dashboard"); }

      try {
        const ms = await get('/dashboard/month-summary');
        setMonth({
          attendanceRate: ms?.attendanceRate ?? null,
          approvedLeaves: ms?.approvedLeaves ?? 0,
          totalExpensesXof: ms?.totalExpensesXof ?? 0,
          pendingValidationsMonth: ms?.pendingValidationsMonth ?? { total: 0, leaves: 0, timesheets: 0, expenses: 0 },
        });
      } catch { /* noop */ }

      try {
        const a = await get('/activity/recent');
        setActivities(a?.activities || []);
      } catch { /* noop */ }

      try {
        const ev = await get('/operations/events');
        setEvents(ev?.events || []);
      } catch { /* noop */ }
    })();
  }, []);

  const kpiCards = useMemo(() => {
    if (!summary) return [];
    return [
      { title: 'Total Employés', value: summary.totalEmployees ?? '—', icon: Users, color: 'text-blue-600',  bgColor: 'bg-blue-100' },
      { title: 'Employés Actifs', value: summary.activeEmployees ?? summary.totalEmployees ?? '—', icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
      { title: 'En Congé', value: summary.onLeave ?? '—', icon: Calendar, color: 'text-orange-600', bgColor: 'bg-orange-100' },
      { title: 'Nouvelles Embauches', value: summary.newHires ?? '—', icon: TrendingUp, color: 'text-purple-600', bgColor: 'bg-purple-100' },
    ];
  }, [summary]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return (events || [])
      .map(e => ({ ...e, dateObj: new Date(e.date) }))
      .filter(e => e.dateObj >= new Date(now.toDateString()))
      .sort((a, b) => a.dateObj - b.dateObj);
  }, [events]);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!summary) return <div className="p-6">Chargement…</div>;

  return (
    <div className="p-6 space-y-5">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour {user?.firstName || user?.email} 👋
          </h1>
        </div>
        <div className="text-sm text-gray-500">{formatDate(new Date())} • {tenantName}</div>
      </div>

      {/* KPI Cards (plus compacts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <Card key={index} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">{kpi.title}</p>
                    <div className="text-xl font-bold text-gray-900">{kpi.value}</div>
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activité récente – compact + scroll interne */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-5 h-5" />
              Activité Récente
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-80 md:max-h-72 overflow-auto pr-1">
              {activities.length === 0 && (<div className="text-sm text-gray-500 p-2">Aucune activité récente</div>)}
              {activities.slice(0, MAX_LIST_ITEMS).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${activity.status === 'pending' ? 'bg-orange-500' : 'bg-green-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{activity.message}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{formatDate(activity.time)}</p>
                  </div>
                  <Badge variant={activity.status === 'pending' ? 'secondary' : 'outline'} className="text-[10px]">
                    {activity.status === 'pending' ? 'En attente' : 'Terminé'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Événements – compact + scroll interne */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-5 h-5" />
              Événements à Venir
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-80 md:max-h-72 overflow-auto pr-1">
              {upcomingEvents.length === 0 && (<div className="text-sm text-gray-500 p-2">Aucun événement à venir</div>)}
              {upcomingEvents.slice(0, MAX_LIST_ITEMS).map((event) => (
                <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                      ${event.type === 'meeting' ? 'bg-blue-100 text-blue-600' : ''}
                      ${event.type === 'training' ? 'bg-green-100 text-green-600' : ''}
                      ${event.type === 'deadline' ? 'bg-red-100 text-red-600' : ''}`}>
                    {event.type === 'meeting' && <Users className="w-4 h-4" />}
                    {event.type === 'training' && <CheckCircle className="w-4 h-4" />}
                    {event.type === 'deadline' && <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{event.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {formatDate(event.date)}{event.time ? ` à ${event.time}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Résumé du Mois – visible sans scroller trop */}
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base">Résumé du Mois</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-emerald-600 mb-0.5">
                {month.attendanceRate != null ? `${Math.round(month.attendanceRate * 100)}%` : '—'}
              </div>
              <div className="text-xs text-gray-600">Taux de présence</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600 mb-0.5">{month.approvedLeaves}</div>
              <div className="text-xs text-gray-600">Congés approuvés</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-600 mb-0.5">
                {new Intl.NumberFormat('fr-FR').format(month.totalExpensesXof)}
              </div>
              <div className="text-xs text-gray-600">Notes de frais (XOF)</div>
            </div>
            <div
              className="text-center"
              title={`Mois • Congés: ${month.pendingValidationsMonth.leaves} • Temps: ${month.pendingValidationsMonth.timesheets} • Frais: ${month.pendingValidationsMonth.expenses}`}
            >
              <div className="text-xl font-bold text-orange-600 mb-0.5">
                {month.pendingValidationsMonth.total ?? 0}
              </div>
              <div className="text-xs text-gray-600">Validations en attente (mois)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HomePage;
