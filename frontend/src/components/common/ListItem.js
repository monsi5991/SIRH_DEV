import React from "react";
import PropTypes from "prop-types";
import { ChevronRight } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export default function ListItem({
  icon: Icon,
  title,
  subtitle,
  badge,
  badgeVariant,
  actionLabel,
  onClick,
  compact,
  disabled,
}) {
  const content = (
    <div
      className={`
        flex items-center justify-between gap-3 rounded-xl border bg-white transition-all duration-150
        ${compact ? "px-3 py-2.5" : "px-4 py-3"}
        ${disabled ? "opacity-60" : "hover:-translate-y-[1px] hover:shadow-sm"}
      `}
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-gray-900">{title}</div>
          {subtitle ? <div className="truncate text-xs text-gray-500">{subtitle}</div> : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {badge ? <Badge variant={badgeVariant}>{badge}</Badge> : null}
        {actionLabel ? (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={onClick}>
            {actionLabel}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (!onClick || actionLabel) return content;

  return (
    <button type="button" className="w-full text-left" onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}

ListItem.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  badge: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.node]),
  badgeVariant: PropTypes.oneOf(["default", "secondary", "destructive", "outline"]),
  actionLabel: PropTypes.string,
  onClick: PropTypes.func,
  compact: PropTypes.bool,
  disabled: PropTypes.bool,
};

ListItem.defaultProps = {
  icon: null,
  subtitle: null,
  badge: null,
  badgeVariant: "outline",
  actionLabel: "",
  onClick: null,
  compact: false,
  disabled: false,
};
