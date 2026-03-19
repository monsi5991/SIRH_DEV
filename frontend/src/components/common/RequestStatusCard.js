import React from "react";
import PropTypes from "prop-types";
import { Clock3 } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { Button } from "../ui/button";

export default function RequestStatusCard({
  request,
  onSelect,
  onCancel,
  canCancel,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{request.title}</p>
          <p className="text-sm text-slate-600">{request.description}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>{request.typeLabel}</span>
            <span>{request.dateLabel}</span>
            {request.priorityLabel ? <span>Priorité {request.priorityLabel}</span> : null}
          </div>
        </div>
        <StatusBadge status={request.status} label={request.statusLabel} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Clock3 className="h-3.5 w-3.5" />
        <span>{request.progressLabel}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {onSelect ? (
          <Button variant="outline" size="sm" onClick={() => onSelect(request)}>
            Voir le détail
          </Button>
        ) : null}
        {canCancel && onCancel ? (
          <Button variant="ghost" size="sm" className="text-rose-700 hover:text-rose-800" onClick={() => onCancel(request)}>
            Annuler
          </Button>
        ) : null}
      </div>
    </div>
  );
}

RequestStatusCard.propTypes = {
  request: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    typeLabel: PropTypes.string,
    dateLabel: PropTypes.string,
    priority: PropTypes.string,
    priorityLabel: PropTypes.string,
    status: PropTypes.string,
    statusLabel: PropTypes.string,
    progressLabel: PropTypes.string,
  }).isRequired,
  onSelect: PropTypes.func,
  onCancel: PropTypes.func,
  canCancel: PropTypes.bool,
};

RequestStatusCard.defaultProps = {
  onSelect: null,
  onCancel: null,
  canCancel: false,
};
