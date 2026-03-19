import React from "react";
import PropTypes from "prop-types";
import { ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

const TONE_CLASSNAMES = {
  neutral: "border-slate-200 bg-white",
  success: "border-emerald-200 bg-emerald-50/60",
  warning: "border-amber-200 bg-amber-50/60",
  danger: "border-rose-200 bg-rose-50/60",
  info: "border-sky-200 bg-sky-50/60",
};

export default function RegularizationGroupSection({ group, onViewDetail }) {
  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm", TONE_CLASSNAMES[group.tone] || TONE_CLASSNAMES.neutral)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{group.title}</p>
          <p className="text-2xl font-semibold text-slate-900">{group.count}</p>
          <p className="text-sm text-slate-600">{group.description}</p>
        </div>
        {group.icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-slate-700 shadow-sm">
            <group.icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {group.previewItems.map((item) => (
          <div key={item.id} className="rounded-xl border border-white/80 bg-white/90 px-3 py-2">
            <p className="text-sm font-medium text-slate-900">{item.title}</p>
            <p className="text-xs text-slate-500">{item.meta}</p>
          </div>
        ))}
        {group.remainingCount > 0 ? (
          <p className="text-xs text-slate-500">+ {group.remainingCount} autre(s) élément(s)</p>
        ) : null}
      </div>

      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={() => onViewDetail(group)}>
          Voir le détail
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

RegularizationGroupSection.propTypes = {
  group: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    count: PropTypes.number.isRequired,
    tone: PropTypes.oneOf(["neutral", "success", "warning", "danger", "info"]),
    icon: PropTypes.elementType,
    previewItems: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        title: PropTypes.string.isRequired,
        meta: PropTypes.string,
      })
    ),
    remainingCount: PropTypes.number,
  }).isRequired,
  onViewDetail: PropTypes.func.isRequired,
};
