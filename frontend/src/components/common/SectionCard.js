import React from "react";
import PropTypes from "prop-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { cn } from "../../lib/utils";

export default function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  headerClassName,
}) {
  const hasHeader = title || description || actions;

  return (
    <Card className={cn("transition-all duration-150 hover:shadow-sm", className)}>
      {hasHeader ? (
        <CardHeader className={cn("pb-4", headerClassName)}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              {title ? <CardTitle className="text-base md:text-lg">{title}</CardTitle> : null}
              {description ? <CardDescription>{description}</CardDescription> : null}
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className={cn(hasHeader ? "pt-0" : "pt-6", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

SectionCard.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  actions: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
  contentClassName: PropTypes.string,
  headerClassName: PropTypes.string,
};

SectionCard.defaultProps = {
  title: null,
  description: null,
  actions: null,
  children: null,
  className: "",
  contentClassName: "",
  headerClassName: "",
};
