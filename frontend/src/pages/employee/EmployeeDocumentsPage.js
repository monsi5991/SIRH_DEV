import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CreditCard, Download, FileText, HelpCircle } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import SectionHeader from "../../components/common/SectionHeader";
import SummaryCard from "../../components/common/SummaryCard";
import InfoBanner from "../../components/common/InfoBanner";
import KPIGrid from "../../components/common/KPIGrid";
import EmptyState from "../../components/common/EmptyState";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import useEmployeeDocuments from "../../hooks/useEmployeeDocuments";
import useEmployeePayslips from "../../hooks/useEmployeePayslips";
import { openSecureFileUrl } from "../../lib/secureFiles";
import { PAYROLL_FAQ_ITEMS } from "./employeeSelfServiceConfig";

function formatMoney(value, currency = "XOF") {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("fr-FR").format(Number(value || 0))} ${currency}`;
}

export default function EmployeeDocumentsPage() {
  const navigate = useNavigate();
  const { formatDate } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") || "payroll";
  const activeTab =
    requestedTab === "policies"
      ? "documents"
      : ["payroll", "documents", "understand"].includes(requestedTab)
      ? requestedTab
      : "payroll";
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [docYearFilter, setDocYearFilter] = useState("");

  const documentsState = useEmployeeDocuments();
  const payslipsState = useEmployeePayslips({ period });

  const latestPayslip = payslipsState.items?.[0] || null;
  const payrollPreview = payslipsState.preview?.result || null;
  const documentItems = useMemo(() => {
    const items = documentsState.documents || [];
    return items
      .map((item) => ({
        id: item.id,
        title: item.label || item.title,
        type: item.type || "DOCUMENT",
        meta: item.createdAt ? formatDate(item.createdAt) : "",
        url: item.url,
        year: item.createdAt ? String(new Date(item.createdAt).getFullYear()) : "",
        isNew: item.createdAt ? (Date.now() - new Date(item.createdAt).getTime()) / 86400000 <= 30 : false,
      }))
      .filter((item) => (docTypeFilter ? item.type === docTypeFilter : true))
      .filter((item) => (docYearFilter ? item.year === docYearFilter : true));
  }, [documentsState.documents, formatDate, docTypeFilter, docYearFilter]);

  const documentTypes = useMemo(
    () => Array.from(new Set((documentsState.documents || []).map((item) => item.type || "DOCUMENT"))),
    [documentsState.documents]
  );
  const documentYears = useMemo(
    () =>
      Array.from(
        new Set(
          (documentsState.documents || [])
            .map((item) => (item.createdAt ? String(new Date(item.createdAt).getFullYear()) : ""))
            .filter(Boolean)
        )
      ).sort((left, right) => right.localeCompare(left)),
    [documentsState.documents]
  );

  const reloadAll = async () => {
    await Promise.allSettled([
      documentsState.reloadDocuments(),
      payslipsState.reload(),
    ]);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Paie & documents"
        description="Retrouvez ici votre paie, vos bulletins et vos documents RH essentiels."
        actions={(
          <>
            <Button variant="outline" onClick={reloadAll}>Rafraîchir</Button>
            <Button onClick={() => navigate("/employee/requests?service=payroll_question&new=1")}>
              Contacter la paie
            </Button>
          </>
        )}
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setSearchParams({ tab: value })}
        className="space-y-6"
      >
        <TabsList className="flex h-auto flex-wrap gap-2 rounded-2xl bg-slate-100 p-2">
          <TabsTrigger value="payroll">Ma paie</TabsTrigger>
          <TabsTrigger value="documents">Mes documents</TabsTrigger>
          <TabsTrigger value="understand">Comprendre ma paie</TabsTrigger>
        </TabsList>

        <TabsContent value="payroll" className="space-y-6">
          {payslipsState.noEmployee ? (
            <InfoBanner
              tone="warning"
              title="Compte à finaliser"
              description="Votre compte n'est pas encore complètement relié à vos informations de paie. L'équipe RH doit finaliser ce lien pour afficher les bulletins."
            />
          ) : null}

          {payslipsState.error && !payslipsState.noEmployee ? (
            <InfoBanner
              tone="info"
              title="Données de paie indisponibles"
              description="Les informations de paie ne sont pas encore disponibles dans cet environnement."
            />
          ) : null}

          <SectionCard>
            <SectionHeader
              title="Résumé paie"
              description="Dernier bulletin publié et aperçu du mois sélectionné."
              actions={(
                <input
                  type="month"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                />
              )}
            />

            <div className="mt-4">
              <KPIGrid>
                <SummaryCard
                  icon={CreditCard}
                  label="Dernier bulletin"
                  value={latestPayslip?.period || "Aucun"}
                  helper={latestPayslip?.createdAt ? `Publié le ${formatDate(latestPayslip.createdAt)}` : "Aucun fichier publié pour le moment"}
                  tone="neutral"
                  action={
                    latestPayslip?.url ? (
                      <Button variant="ghost" size="sm" className="h-auto px-0 text-emerald-700" onClick={() => openSecureFileUrl(latestPayslip.url)}>
                        Télécharger
                      </Button>
                    ) : null
                  }
                />
                <SummaryCard
                  label="Net estimé"
                  value={payrollPreview ? formatMoney(payrollPreview.net, payrollPreview.currency) : "—"}
                  helper={payrollPreview ? "Montant net sur la période sélectionnée" : "Aperçu non disponible pour le moment"}
                  tone="success"
                />
                <SummaryCard
                  label="Période consultée"
                  value={period}
                  helper="Sélectionnez un autre mois pour vérifier l'historique disponible"
                  tone="info"
                />
              </KPIGrid>
            </div>
          </SectionCard>

          <SectionCard
            title="Historique des bulletins"
            description="Consultez et téléchargez les bulletins publiés."
          >
            <div className="mt-4">
              {payslipsState.loading ? (
                <div className="text-sm text-slate-500">Chargement des bulletins…</div>
              ) : payslipsState.items?.length ? (
                <div className="space-y-3">
                  {payslipsState.items.map((item) => (
                    <div key={`${item.period}-${item.createdAt}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">Bulletin {item.period}</p>
                        <p className="text-xs text-slate-500">
                          Publié le {item.createdAt ? formatDate(item.createdAt) : "date inconnue"}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openSecureFileUrl(item.url)}>
                        <Download className="h-4 w-4" />
                        Télécharger
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="Aucun bulletin disponible"
                  description={`Aucun bulletin publié pour ${period}.`}
                  compact
                />
              )}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="understand" className="space-y-6">
          <InfoBanner
            tone="info"
            title="Comprendre les montants visibles"
            description="Cette rubrique reste volontairement courte. Pour les procédures et les questions détaillées, utilisez Aide RH ou une demande paie."
            action={(
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => navigate("/employee/help")}>Aide RH</Button>
                <Button onClick={() => navigate("/employee/requests?service=payroll_question&new=1")}>Poser une question</Button>
              </div>
            )}
          />

          <SectionCard
            title="Aperçu de la période"
            description="Vue synthétique des montants disponibles sur la période sélectionnée."
          >
            {payrollPreview ? (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Salaire brut</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(payrollPreview.gross, payrollPreview.currency)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Salaire net</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(payrollPreview.net, payrollPreview.currency)}</p>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={HelpCircle}
                title="Aucun aperçu disponible"
                description="L'explication des montants s'activera dès que le flux paie sera relié à cet espace."
                compact
              />
            )}
          </SectionCard>

          <SectionCard
            title="Repères utiles"
            description="Deux réponses rapides seulement, le reste est centralisé dans Aide RH."
          >
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {PAYROLL_FAQ_ITEMS.slice(0, 2).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.text}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <SectionCard>
            <SectionHeader
              title="Mes documents"
              description="Contrats, avenants, attestations et documents RH publiés."
              actions={(
                <div className="flex flex-wrap gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={docTypeFilter}
                    onChange={(e) => setDocTypeFilter(e.target.value)}
                  >
                    <option value="">Tous les types</option>
                    {documentTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={docYearFilter}
                    onChange={(e) => setDocYearFilter(e.target.value)}
                  >
                    <option value="">Toutes les années</option>
                    {documentYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              )}
            />

            <div className="mt-4">
              {documentsState.documentsLoading ? (
                <div className="text-sm text-slate-500">Chargement des documents…</div>
              ) : documentsState.documentsError ? (
                <InfoBanner tone="warning" title="Documents indisponibles" description={documentsState.documentsError} />
              ) : documentItems.length ? (
                <div className="space-y-3">
                  {documentItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                          {item.isNew ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              Nouveau
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500">{[item.type, item.meta].filter(Boolean).join(" · ")}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openSecureFileUrl(item.url)}>
                        Ouvrir
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="Aucun document disponible"
                  description="Les documents RH visibles pour votre profil apparaîtront ici."
                  compact
                />
              )}
            </div>
          </SectionCard>

          <InfoBanner
            tone="info"
            title="Procédures RH centralisées ailleurs"
            description="Les politiques et procédures RH restent dans Aide RH pour éviter un doublon documentaire dans cette page."
            action={<Button variant="outline" onClick={() => navigate("/employee/help")}>Voir l'aide RH</Button>}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
