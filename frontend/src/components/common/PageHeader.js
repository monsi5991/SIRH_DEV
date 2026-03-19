import React from "react";
import PropTypes from "prop-types";
import { cn } from "../../lib/utils";
import usePageMeta from "../../hooks/usePageMeta";

export default function PageHeader({
  title,
  description,
  actions,
  children,
  className,
  metaTitle,
  metaDescription,
}) {
  usePageMeta(typeof title === "string" ? title : metaTitle, typeof description === "string" ? description : metaDescription);

  return (
    <div className={cn("flex flex-col gap-4 md:gap-5", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
          {description ? <p className="text-sm text-gray-600 md:text-base">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div>{children}</div> : null}
    </div>
  );
}

PageHeader.propTypes = {
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  actions: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
  metaTitle: PropTypes.string,
  metaDescription: PropTypes.string,
};

PageHeader.defaultProps = {
  description: null,
  actions: null,
  children: null,
  className: "",
  metaTitle: "",
  metaDescription: "",
};
