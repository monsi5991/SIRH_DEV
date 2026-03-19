import React from "react";
import PropTypes from "prop-types";
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

export default function ActionCard({
  icon: Icon,
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  footer,
  tone,
  className,
}) {
  return (
    <Card className={cn("shadow-sm", TONE_CLASSNAMES[tone] || TONE_CLASSNAMES.neutral, className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-slate-700 shadow-sm">
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
          <div className="space-y-1">
            <CardTitle className="text-base text-slate-900">{title}</CardTitle>
            {description ? <p className="text-sm text-slate-600">{description}</p> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-2">
          {primaryActionLabel && onPrimaryAction ? (
            <Button onClick={onPrimaryAction}>{primaryActionLabel}</Button>
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <Button variant="outline" onClick={onSecondaryAction}>{secondaryActionLabel}</Button>
          ) : null}
        </div>
        {footer ? <div>{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

ActionCard.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  primaryActionLabel: PropTypes.string,
  onPrimaryAction: PropTypes.func,
  secondaryActionLabel: PropTypes.string,
  onSecondaryAction: PropTypes.func,
  footer: PropTypes.node,
  tone: PropTypes.oneOf(["neutral", "success", "warning", "danger", "info"]),
  className: PropTypes.string,
};

ActionCard.defaultProps = {
  icon: null,
  description: null,
  primaryActionLabel: "",
  onPrimaryAction: null,
  secondaryActionLabel: "",
  onSecondaryAction: null,
  footer: null,
  tone: "neutral",
  className: "",
};
