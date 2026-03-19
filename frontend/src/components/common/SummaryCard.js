import React from "react";
import PropTypes from "prop-types";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

const TONE_CLASSNAMES = {
  neutral: "border-slate-200 bg-white",
  success: "border-emerald-200 bg-emerald-50/70",
  warning: "border-amber-200 bg-amber-50/70",
  danger: "border-rose-200 bg-rose-50/70",
  info: "border-sky-200 bg-sky-50/70",
};

export default function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
  actionLabel,
  onAction,
  action,
  className,
}) {
  return (
    <Card className={cn("shadow-sm", TONE_CLASSNAMES[tone] || TONE_CLASSNAMES.neutral, className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {label}
            </CardTitle>
            <div className="text-2xl font-semibold text-slate-900">{value}</div>
          </div>
          {Icon ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-slate-700 shadow-sm">
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {helper ? <p className="text-sm text-slate-600">{helper}</p> : null}
        {action ? (
          <div>{action}</div>
        ) : actionLabel && onAction ? (
          <Button variant="ghost" size="sm" className="h-auto px-0 text-emerald-700 hover:text-emerald-800" onClick={onAction}>
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

SummaryCard.propTypes = {
  icon: PropTypes.elementType,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.node]).isRequired,
  helper: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  tone: PropTypes.oneOf(["neutral", "success", "warning", "danger", "info"]),
  actionLabel: PropTypes.string,
  onAction: PropTypes.func,
  action: PropTypes.node,
  className: PropTypes.string,
};

SummaryCard.defaultProps = {
  icon: null,
  helper: null,
  tone: "neutral",
  actionLabel: "",
  onAction: null,
  action: null,
  className: "",
};
