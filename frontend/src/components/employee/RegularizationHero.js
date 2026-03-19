import React from "react";
import PropTypes from "prop-types";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export default function RegularizationHero({
  actionableCount,
  blockingCount,
  title,
  description,
  recommendation,
  periodLabel,
  primaryActionLabel,
  onPrimaryAction,
}) {
  const isCritical = blockingCount > 0;
  const Icon = isCritical ? AlertTriangle : CheckCircle2;

  return (
    <div
      className={cn(
        "rounded-3xl border p-6 shadow-sm",
        isCritical ? "border-amber-200 bg-amber-50/80" : "border-emerald-200 bg-emerald-50/70"
      )}
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90 text-slate-700 shadow-sm">
              <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Régularisations</p>
              <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
              <p className="max-w-2xl text-sm text-slate-700">{description}</p>
            </div>
          </div>

          {(recommendation || periodLabel) ? (
            <div className="space-y-1">
              {recommendation ? <p className="text-sm font-medium text-slate-900">{recommendation}</p> : null}
              {periodLabel ? <p className="text-xs text-slate-500">Période analysée: {periodLabel}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[360px]">
          <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Jours à régulariser</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{actionableCount}</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Anomalies bloquantes</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{blockingCount}</p>
          </div>
          {primaryActionLabel && onPrimaryAction ? (
            <div className="sm:col-span-2">
              <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={onPrimaryAction}>
                {primaryActionLabel}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

RegularizationHero.propTypes = {
  actionableCount: PropTypes.number,
  blockingCount: PropTypes.number,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  recommendation: PropTypes.string,
  periodLabel: PropTypes.string,
  primaryActionLabel: PropTypes.string,
  onPrimaryAction: PropTypes.func,
};

RegularizationHero.defaultProps = {
  actionableCount: 0,
  blockingCount: 0,
  recommendation: "",
  periodLabel: "",
  primaryActionLabel: "",
  onPrimaryAction: null,
};
