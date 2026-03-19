import React from "react";
import PropTypes from "prop-types";

export default function KPIChip({ icon: Icon, label, value, tone }) {
  const toneClasses = {
    neutral: "border-gray-200 bg-white text-gray-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-orange-200 bg-orange-50 text-orange-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${toneClasses[tone] || toneClasses.neutral}`}>
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      <span className="opacity-80">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

KPIChip.propTypes = {
  icon: PropTypes.elementType,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.node]).isRequired,
  tone: PropTypes.oneOf(["neutral", "success", "warning", "danger", "info"]),
};

KPIChip.defaultProps = {
  icon: null,
  tone: "neutral",
};
