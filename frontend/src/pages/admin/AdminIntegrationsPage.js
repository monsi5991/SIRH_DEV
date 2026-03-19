import React, { useEffect, useMemo, useState } from "react";
import { get } from "../../lib/api";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import HelpTooltip from "../../components/common/HelpTooltip";
import { ListSkeleton } from "../../components/common/Skeletons";
import usePageMeta from "../../hooks/usePageMeta";
import { PlugZap, RefreshCw, ShieldCheck, Wallet } from "lucide-react";

function tierLabel(value) {
  if (value === "sandbox") return "Bac a sable";
  if (value === "free") return "Sans cle";
  return value || "A qualifier";
}

function paymentModeLabel(value) {
  if (value === "sandbox_or_live") return "Pret a cadrer";
  if (value === "not_configured") return "Non configure";
  return value || "A verifier";
}

function statusClass(active) {
  return active
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

export default function AdminIntegrationsPage() {
  usePageMeta(
    "Integrations & connecteurs",
    "SSO, export paie, paiements et connecteurs externes pour fiabiliser le SIRH sans complexifier le deploiement."
  );

  const [catalog, setCatalog] = useState([]);
  const [payments, setPayments] = useState([]);
  const [recommendation, setRecommendation] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await get("/connectors/catalog");
      setCatalog(Array.isArray(res?.items) ? res.items : []);
      setPayments(Array.isArray(res?.payments?.providers) ? res.payments.providers : []);
      setRecommendation(res?.payments?.recommendation || "");
    } catch (e) {
      setCatalog([]);
      setPayments([]);
      setRecommendation("");
      setError(e?.message || "Impossible de charger les integrations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const configuredPayments = useMemo(
    () => payments.filter((provider) => provider?.configured).length,
    [payments]
  );

  const sandboxReadyConnectors = useMemo(
    () => catalog.filter((item) => item?.freeTier === "sandbox").length,
    [catalog]
  );

  const freeConnectors = useMemo(
    () => catalog.filter((item) => item?.freeTier === "free").length,
    [catalog]
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Integrations & connecteurs"
        description="Cadrez les briques externes utiles au SIRH: identite, paie, remboursements, calendrier, meteo et donnees pays."
        actions={
          <Button variant="outline" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Rafraichir
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-base">SSO & acces</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">1</div>
            <div className="mt-1 text-sm text-slate-600">Keycloak actif pour centraliser la connexion.</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Paiements configures</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{configuredPayments}</div>
            <div className="mt-1 text-sm text-slate-600">Connecteurs pret pour tests de remboursement.</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Connecteurs en bac a sable</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{sandboxReadyConnectors}</div>
            <div className="mt-1 text-sm text-slate-600">Briques a cadrer avant usage reel.</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Sources prêtes sans cle</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{freeConnectors}</div>
            <div className="mt-1 text-sm text-slate-600">Connecteurs utiles pour planning, jours feries et localisation.</div>
          </CardContent>
        </Card>
      </div>

      <SectionCard
        title={<span className="inline-flex items-center gap-2">Acces & gouvernance <HelpTooltip content="Le SSO doit rassurer sur l'acces, tandis que les autres integrations doivent etre activees progressivement selon le niveau de maturite de l'organisation." /></span>}
        description="Commencez par les flux qui securisent l'acces et reduisent le travail manuel, avant d'ouvrir des integrations plus sensibles."
        className="border-emerald-100 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium text-slate-900">Keycloak SSO</div>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Connecte</Badge>
            </div>
            <div className="mt-2 text-sm text-slate-600">
              L&apos;authentification est centralisee pour mieux gouverner les acces, la sortie des comptes et les politiques de securite.
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium text-slate-900">Export paie</div>
              <Badge className="border-amber-200 bg-amber-50 text-amber-700">A cadrer</Badge>
            </div>
            <div className="mt-2 text-sm text-slate-600">
              A brancher quand les cycles RH, les rubriques et les controles de donnees sont stabilises par pays ou par entite.
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={<span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-amber-600" /> Remboursements & paiements</span>}
        description="Ces connecteurs servent surtout a fiabiliser les remboursements, avances ou paiements pilotes, sans melanger trop vite la paie et l'encaissement."
        className="border-emerald-100 shadow-sm"
      >
        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <EmptyState icon={Wallet} title="Impossible de charger les connecteurs paiement" description={error} actionLabel="Reessayer" onAction={load} compact />
        ) : payments.length ? (
          <div className="space-y-3">
            {payments.map((provider) => (
              <div key={provider.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{provider.name}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      A utiliser d&apos;abord sur des flux limites et traces avant extension a plus de cas d&apos;usage.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusClass(provider.configured)}>{paymentModeLabel(provider.mode)}</Badge>
                    <Badge variant="outline">{provider.configured ? "Pret pour tests" : "Parametres manquants"}</Badge>
                  </div>
                </div>
              </div>
            ))}
            {recommendation ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <div className="font-medium">Recommandation de deploiement</div>
                <div className="mt-1">{recommendation}</div>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            icon={Wallet}
            title="Aucun connecteur paiement visible"
            description="Les fournisseurs de remboursement et paiement apparaitront ici apres chargement du catalogue."
            compact
          />
        )}
      </SectionCard>

      <SectionCard
        title={<span className="inline-flex items-center gap-2"><PlugZap className="h-4 w-4 text-emerald-700" /> Catalogue disponible</span>}
        description="Chaque connecteur doit etre justifie par un gain metier concret: planning, pilotage, localisation pays ou reduction de la ressaisie."
        className="border-emerald-100 shadow-sm"
      >
        {loading ? (
          <ListSkeleton rows={6} />
        ) : error ? (
          <EmptyState icon={PlugZap} title="Impossible de charger le catalogue" description={error} actionLabel="Reessayer" onAction={load} compact />
        ) : catalog.length ? (
          <div className="space-y-3">
            {catalog.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-slate-900">{item.provider}</div>
                      <Badge variant="outline">{tierLabel(item.freeTier)}</Badge>
                      <Badge className={statusClass(item.auth === "none")}>
                        {item.auth === "none" ? "Activation simple" : "Cle requise"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-slate-600 break-all">{item.endpoint}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(item.modules || []).map((module) => (
                        <Badge key={`${item.id}-${module}`} variant="secondary">{module}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {item.auth === "none"
                      ? "Peut etre active rapidement pour enrichir le pilotage."
                      : "A cadrer avec cles, tests et gouvernance avant ouverture."}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="Aucun connecteur disponible"
            description="Le catalogue se remplira ici des que les connecteurs seront exposes par l'API."
            compact
          />
        )}
      </SectionCard>
    </div>
  );
}
