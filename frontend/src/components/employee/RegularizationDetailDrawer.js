import React from "react";
import PropTypes from "prop-types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Button } from "../ui/button";
import EmptyState from "../common/EmptyState";
import InfoBanner from "../common/InfoBanner";
import StatusBadge from "../common/StatusBadge";

function severityConfig(severity) {
  const normalized = String(severity || "").toUpperCase();
  if (normalized === "HIGH") {
    return {
      label: "Bloquante",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (normalized === "MEDIUM") {
    return {
      label: "À corriger",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  return {
    label: "Information",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  };
}

export default function RegularizationDetailDrawer({
  open,
  onOpenChange,
  group,
  onPrimaryAction,
  onSecondaryAction,
  onItemAction,
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{group?.detailTitle || group?.title || "Détail des régularisations"}</SheetTitle>
          <SheetDescription>{group?.detailDescription || "Consultez le détail de cette catégorie avant de corriger."}</SheetDescription>
        </SheetHeader>

        {group ? (
          <div className="mt-6 space-y-6">
            <InfoBanner
              tone={group.tone === "danger" ? "warning" : group.tone === "success" ? "success" : "info"}
              title={`${group.count} élément(s) dans cette catégorie`}
              description={group.description}
              action={(
                <div className="flex flex-wrap gap-2">
                  {(group.detailPrimaryActionLabel || group.primaryActionLabel) && onPrimaryAction ? (
                    <Button size="sm" onClick={() => onPrimaryAction(group)}>
                      {group.detailPrimaryActionLabel || group.primaryActionLabel}
                    </Button>
                  ) : null}
                  {(group.detailSecondaryActionLabel || group.secondaryActionLabel) && onSecondaryAction ? (
                    <Button size="sm" variant="outline" onClick={() => onSecondaryAction(group)}>
                      {group.detailSecondaryActionLabel || group.secondaryActionLabel}
                    </Button>
                  ) : null}
                </div>
              )}
            />

            <div className="space-y-3">
              {group.items.length ? group.items.map((item) => {
                const severity = severityConfig(item.severity);
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.dateLabel}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.status ? <StatusBadge status={item.status} /> : null}
                        {item.severity ? (
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${severity.className}`}>
                            {severity.label}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {item.codeLabel ? (
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {item.codeLabel}
                      </p>
                    ) : null}
                    {item.detail ? <p className="mt-2 text-sm text-slate-700">{item.detail}</p> : null}
                    {item.comment ? <p className="mt-2 text-sm text-slate-600">{item.comment}</p> : null}
                    {item.suggestedAction ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        Action possible: {item.suggestedAction}
                      </div>
                    ) : null}
                    {item.escalationEligible ? (
                      <p className="mt-2 text-xs font-medium text-amber-700">Escalade RH possible sur ce cas.</p>
                    ) : null}
                    {onItemAction && group.id !== "pending" ? (
                      <div className="mt-4">
                        <Button size="sm" variant="outline" onClick={() => onItemAction(item)}>
                          {item.timesheetId ? "Corriger cette saisie" : "Ajouter une saisie corrective"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              }) : (
                <EmptyState
                  title="Aucun élément dans cette catégorie"
                  description="Le détail apparaitra ici si des cas sont détectés."
                  compact
                />
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

RegularizationDetailDrawer.propTypes = {
  open: PropTypes.bool,
  onOpenChange: PropTypes.func,
  group: PropTypes.shape({
    title: PropTypes.string,
    detailTitle: PropTypes.string,
    detailDescription: PropTypes.string,
    description: PropTypes.string,
    tone: PropTypes.string,
    count: PropTypes.number,
    primaryActionLabel: PropTypes.string,
    secondaryActionLabel: PropTypes.string,
    detailPrimaryActionLabel: PropTypes.string,
    detailSecondaryActionLabel: PropTypes.string,
    items: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        title: PropTypes.string.isRequired,
        dateLabel: PropTypes.string,
        codeLabel: PropTypes.string,
        detail: PropTypes.string,
        comment: PropTypes.string,
        severity: PropTypes.string,
        status: PropTypes.string,
        suggestedAction: PropTypes.string,
        escalationEligible: PropTypes.bool,
        timesheetId: PropTypes.string,
      })
    ),
  }),
  onPrimaryAction: PropTypes.func,
  onSecondaryAction: PropTypes.func,
  onItemAction: PropTypes.func,
};

RegularizationDetailDrawer.defaultProps = {
  open: false,
  onOpenChange: () => {},
  group: null,
  onPrimaryAction: null,
  onSecondaryAction: null,
  onItemAction: null,
};
