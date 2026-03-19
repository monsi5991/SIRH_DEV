import React from "react";
import PropTypes from "prop-types";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "../../lib/utils";

const TONE_MAP = {
  info: {
    icon: Info,
    className: "border-sky-200 bg-sky-50 text-sky-900",
  },
  success: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  danger: {
    icon: AlertCircle,
    className: "border-rose-200 bg-rose-50 text-rose-900",
  },
};

export default function InfoBanner({
  tone,
  title,
  description,
  action,
  className,
}) {
  const resolved = TONE_MAP[tone] || TONE_MAP.info;
  const Icon = resolved.icon;

  return (
    <div className={cn("rounded-2xl border px-4 py-3 shadow-sm", resolved.className, className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/80">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {title ? <p className="text-sm font-semibold">{title}</p> : null}
          {description ? <p className="text-sm opacity-90">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

InfoBanner.propTypes = {
  tone: PropTypes.oneOf(["info", "success", "warning", "danger"]),
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  action: PropTypes.node,
  className: PropTypes.string,
};

InfoBanner.defaultProps = {
  tone: "info",
  title: null,
  description: null,
  action: null,
  className: "",
};
