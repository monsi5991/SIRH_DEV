import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Bell,
  Clock3,
  Save,
  Settings,
  ShieldCheck,
  Smartphone,
  User,
  Wallet,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { useAuth } from "../../contexts/AuthContext";
import usePageMeta from "../../hooks/usePageMeta";

const STORAGE_KEY = "sirh.settings.v1";

function readStoredSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function buildDefaultState(user) {
  return {
    profile: {
      phone: user?.phone || "",
      locale: "fr",
      timezone: "Africa/Dakar",
      dateFormat: "DD/MM/YYYY",
    },
    notifications: {
      emailApprovals: true,
      emailReminders: true,
      inAppAlerts: true,
      smsCritical: false,
    },
    mobile: {
      dataSaver: true,
      uploadQuality: "medium",
      syncMode: "wifi",
    },
    reimbursement: {
      method: "mobile_money",
      provider: "Orange Money",
      walletNumber: "",
      currency: "XOF",
    },
    ui: {
      density: "comfortable",
      startPage: "/",
    },
  };
}

function mergeState(base, incoming) {
  if (!incoming) return base;
  return {
    ...base,
    ...incoming,
    profile: { ...base.profile, ...(incoming.profile || {}) },
    notifications: { ...base.notifications, ...(incoming.notifications || {}) },
    mobile: { ...base.mobile, ...(incoming.mobile || {}) },
    reimbursement: { ...base.reimbursement, ...(incoming.reimbursement || {}) },
    ui: { ...base.ui, ...(incoming.ui || {}) },
  };
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 cursor-pointer hover:bg-slate-50">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {description ? <p className="text-xs text-slate-500 mt-0.5">{description}</p> : null}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={`
          relative h-6 w-11 rounded-full transition-colors
          ${checked ? "bg-emerald-600" : "bg-slate-300"}
        `}
        aria-pressed={checked}
      >
        <span
          className={`
            absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform
            ${checked ? "translate-x-5" : "translate-x-0.5"}
          `}
        />
      </button>
    </label>
  );
}

ToggleRow.propTypes = {
  label: PropTypes.string.isRequired,
  description: PropTypes.string,
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
};

ToggleRow.defaultProps = {
  description: "",
};

export default function SettingsPage() {
  const { user } = useAuth();
  usePageMeta("Paramètres", "Préférences de travail, notifications, mobile et sécurité pour votre espace RH.");

  const initialState = useMemo(() => {
    const defaults = buildDefaultState(user);
    const stored = readStoredSettings();
    return mergeState(defaults, stored);
  }, [user]);

  const [state, setState] = useState(initialState);
  const [savedAt, setSavedAt] = useState(null);
  const [dirty, setDirty] = useState(false);

  const update = (section, field, value) => {
    setState((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
    setDirty(true);
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSavedAt(new Date());
    setDirty(false);
  };

  const reset = () => {
    const defaults = buildDefaultState(user);
    setState(defaults);
    setDirty(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gradient-to-b from-slate-50 via-white to-white min-h-full">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-800 text-white shadow-lg">
        <div className="absolute -top-20 -right-16 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-emerald-300/20 blur-3xl" />

        <div className="relative p-5 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs font-medium">
                <Settings className="h-3.5 w-3.5" /> Préférences de travail
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mt-2">Paramètres</h1>
              <p className="text-sm text-emerald-100/90 mt-1 max-w-2xl">
                Ajustez vos notifications, vos usages mobile et vos préférences d&apos;affichage pour travailler plus vite au quotidien.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {dirty ? <Badge className="bg-amber-500/20 border border-amber-300/30 text-amber-100">Modifications non sauvegardées</Badge> : null}
              {savedAt ? (
                <Badge className="bg-white/10 border border-white/20 text-white">
                  Sauvegardé à {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Badge>
              ) : null}
              <Button
                variant="outline"
                onClick={reset}
                className="border-white/30 text-white bg-white/10 hover:bg-white/20"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" /> Réinitialiser
              </Button>
              <Button onClick={save} className="bg-white text-emerald-900 hover:bg-emerald-50">
                <Save className="h-4 w-4 mr-1.5" /> Enregistrer
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-4.5 w-4.5 text-emerald-700" /> Mon compte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Nom complet</label>
                <input
                  type="text"
                  disabled
                  value={`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "—"}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Email</label>
                <input
                  type="text"
                  disabled
                  value={user?.email || "—"}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Téléphone</label>
                <input
                  type="text"
                  value={state.profile.phone}
                  onChange={(e) => update("profile", "phone", e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  placeholder="+221 77 000 00 00"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Langue</label>
                <select
                  value={state.profile.locale}
                  onChange={(e) => update("profile", "locale", e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Fuseau horaire</label>
                <select
                  value={state.profile.timezone}
                  onChange={(e) => update("profile", "timezone", e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="Africa/Dakar">Africa/Dakar</option>
                  <option value="Africa/Abidjan">Africa/Abidjan</option>
                  <option value="Africa/Bamako">Africa/Bamako</option>
                  <option value="Africa/Ouagadougou">Africa/Ouagadougou</option>
                  <option value="Africa/Conakry">Africa/Conakry</option>
                  <option value="Africa/Lagos">Africa/Lagos</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Format date</label>
                <select
                  value={state.profile.dateFormat}
                  onChange={(e) => update("profile", "dateFormat", e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-4.5 w-4.5 text-indigo-600" /> Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <ToggleRow
              label="Emails validations"
              description="Recevoir un email lorsqu&apos;une demande attend votre validation"
              checked={state.notifications.emailApprovals}
              onChange={(v) => update("notifications", "emailApprovals", v)}
            />
            <ToggleRow
              label="Rappels RH"
              description="Être averti des échéances RH, documents à renouveler et campagnes en retard"
              checked={state.notifications.emailReminders}
              onChange={(v) => update("notifications", "emailReminders", v)}
            />
            <ToggleRow
              label="Alertes in-app"
              description="Afficher les alertes et validations directement dans l&apos;application"
              checked={state.notifications.inAppAlerts}
              onChange={(v) => update("notifications", "inAppAlerts", v)}
            />
            <ToggleRow
              label="SMS critiques"
              description="Recevoir les alertes urgentes quand une action immédiate est requise"
              checked={state.notifications.smsCritical}
              onChange={(v) => update("notifications", "smsCritical", v)}
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Smartphone className="h-4.5 w-4.5 text-sky-600" /> Mobile & connectivité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow
              label="Mode économie de données"
              description="Réduit le volume de données utilisé sur mobile et réseau instable"
              checked={state.mobile.dataSaver}
              onChange={(v) => update("mobile", "dataSaver", v)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Qualité upload justificatifs</label>
                <select
                  value={state.mobile.uploadQuality}
                  onChange={(e) => update("mobile", "uploadQuality", e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="low">Faible</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Élevée</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Synchronisation</label>
                <select
                  value={state.mobile.syncMode}
                  onChange={(e) => update("mobile", "syncMode", e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="wifi">Wi‑Fi uniquement</option>
                  <option value="always">Toujours</option>
                  <option value="manual">Manuelle</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-4.5 w-4.5 text-amber-600" /> Remboursement & interface</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Méthode de remboursement</label>
                <select
                  value={state.reimbursement.method}
                  onChange={(e) => update("reimbursement", "method", e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank_transfer">Virement bancaire</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Opérateur / Banque</label>
                <select
                  value={state.reimbursement.provider}
                  onChange={(e) => update("reimbursement", "provider", e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="Orange Money">Orange Money</option>
                  <option value="Wave">Wave</option>
                  <option value="MTN MoMo">MTN MoMo</option>
                  <option value="Moov Money">Moov Money</option>
                  <option value="Free Money">Free Money</option>
                  <option value="Bank">Bank</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Numéro wallet / compte</label>
                <input
                  type="text"
                  value={state.reimbursement.walletNumber}
                  onChange={(e) => update("reimbursement", "walletNumber", e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  placeholder="Masqué à l&apos;écran pour plus de confidentialité"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Devise</label>
                <select
                  value={state.reimbursement.currency}
                  onChange={(e) => update("reimbursement", "currency", e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="XOF">XOF</option>
                  <option value="NGN">NGN</option>
                  <option value="GHS">GHS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Densité d&apos;affichage</label>
                <select
                  value={state.ui.density}
                  onChange={(e) => update("ui", "density", e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="comfortable">Confortable</option>
                  <option value="compact">Compacte</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Page de démarrage</label>
                <select
                  value={state.ui.startPage}
                  onChange={(e) => update("ui", "startPage", e.target.value)}
                  className="mt-1 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="/">Accueil selon mon rôle</option>
                  <option value="/hr/dashboard">Accueil RH</option>
                  <option value="/employee/dashboard">Accueil employé</option>
                  <option value="/manager/dashboard">Accueil manager</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4.5 w-4.5 text-emerald-700" /> Sécurité
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Authentification</p>
            <p className="font-medium text-slate-900 mt-1">Keycloak SSO</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
            <p className="text-xs text-slate-500 uppercase tracking-wide">MFA</p>
            <p className="font-medium text-slate-900 mt-1">Géré côté fournisseur d&apos;identité</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Session</p>
            <p className="font-medium text-slate-900 mt-1">Synchronisée via token sécurisé</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-100 bg-emerald-50/50">
        <CardContent className="p-4 text-xs text-emerald-800 flex items-center gap-2">
          <Clock3 className="h-4 w-4" />
          Vos préférences sont conservées sur cet appareil pour garder votre espace clair, rapide et adapté à votre usage.
        </CardContent>
      </Card>
    </div>
  );
}
