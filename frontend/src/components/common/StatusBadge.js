import React from "react";
import PropTypes from "prop-types";
import { Badge } from "../ui/badge";

const STATUS_MAP = {
  ACTIVE: { label: "Actif", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  INACTIVE: { label: "Inactif", className: "border-slate-200 bg-slate-100 text-slate-700" },
  PENDING: { label: "En attente", className: "border-amber-200 bg-amber-50 text-amber-700" },
  SUBMITTED: { label: "Soumis", className: "border-amber-200 bg-amber-50 text-amber-700" },
  DRAFT: { label: "Brouillon", className: "border-slate-200 bg-slate-100 text-slate-700" },
  APPROVED: { label: "Approuvé", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  VALIDATED: { label: "Validé", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  PAID: { label: "Payé", className: "border-teal-200 bg-teal-50 text-teal-700" },
  REJECTED: { label: "Rejeté", className: "border-rose-200 bg-rose-50 text-rose-700" },
  CANCELED: { label: "Annulé", className: "border-slate-200 bg-slate-100 text-slate-700" },
  CLOSED: { label: "Clôturé", className: "border-sky-200 bg-sky-50 text-sky-700" },
  PENDING_MANAGER: { label: "En attente N+1", className: "border-amber-200 bg-amber-50 text-amber-700" },
  PENDING_HR: { label: "En attente RH", className: "border-orange-200 bg-orange-50 text-orange-700" },
  PENDING_FINANCE: { label: "En attente finance", className: "border-orange-200 bg-orange-50 text-orange-700" },
  PENDING_DIRECTION: { label: "En attente direction", className: "border-orange-200 bg-orange-50 text-orange-700" },
  AT_RISK: { label: "À risque", className: "border-amber-200 bg-amber-50 text-amber-700" },
  OFF_TRACK: { label: "En retard", className: "border-rose-200 bg-rose-50 text-rose-700" },
  ON_TRACK: { label: "En bonne voie", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase().replace(/\s+/g, "_");
}

export default function StatusBadge({ status, label, className }) {
  const key = normalizeStatus(status);
  const config = STATUS_MAP[key] || {
    label: label || String(status || "—"),
    className: "border-slate-200 bg-slate-100 text-slate-700",
  };

  return (
    <Badge className={`border font-medium ${config.className} ${className}`.trim()}>
      {label || config.label}
    </Badge>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  label: PropTypes.string,
  className: PropTypes.string,
};

StatusBadge.defaultProps = {
  status: "",
  label: "",
  className: "",
};
