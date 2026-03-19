import React from "react";
import PropTypes from "prop-types";
import { cn } from "../../lib/utils";

export default function SectionHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}) {
  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-start md:justify-between", className)}>
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="max-w-3xl text-sm text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

SectionHeader.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  actions: PropTypes.node,
  eyebrow: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  className: PropTypes.string,
};

SectionHeader.defaultProps = {
  description: null,
  actions: null,
  eyebrow: null,
  className: "",
};
