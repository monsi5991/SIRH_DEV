import React from "react";
import PropTypes from "prop-types";
import { cn } from "../../lib/utils";

export default function KPIGrid({ children, className }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {children}
    </div>
  );
}

KPIGrid.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

KPIGrid.defaultProps = {
  children: null,
  className: "",
};
