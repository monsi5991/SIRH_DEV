import React from "react";
import PropTypes from "prop-types";
import { Info } from "lucide-react";
import { Button } from "../ui/button";

export default function EmptyState({
  icon: Icon = Info,
  title,
  description = null,
  actionLabel = "",
  onAction = null,
  action = null,
  compact = false,
}) {
  const ResolvedIcon =
    Icon && (typeof Icon === "function" || typeof Icon === "object") ? Icon : Info;

  return (
    <div
      className={`
        flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200
        bg-gray-50/70 text-center
        ${compact ? "p-6" : "p-10"}
      `}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500">
        {ResolvedIcon ? (
          <ResolvedIcon className="h-5 w-5" aria-hidden="true" />
        ) : (
          <span className="text-sm font-semibold" aria-hidden="true">i</span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-gray-900 md:text-base">{title}</h3>
      {description ? <p className="mt-1 max-w-xl text-sm text-gray-600">{description}</p> : null}
      {action ? (
        <div className="mt-4">{action}</div>
      ) : actionLabel && onAction ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  actionLabel: PropTypes.string,
  onAction: PropTypes.func,
  action: PropTypes.node,
  compact: PropTypes.bool,
};
