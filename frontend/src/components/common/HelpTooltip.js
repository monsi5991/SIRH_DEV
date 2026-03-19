import React from "react";
import PropTypes from "prop-types";
import { Info } from "lucide-react";

export default function HelpTooltip({ content, label }) {
  if (!content) return null;

  return (
    <span
      title={typeof content === "string" ? content : label}
      aria-label={label}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"
    >
      <Info className="h-3.5 w-3.5" />
    </span>
  );
}

HelpTooltip.propTypes = {
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  label: PropTypes.string,
};

HelpTooltip.defaultProps = {
  content: null,
  label: "Aide",
};
