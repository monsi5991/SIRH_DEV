import React from "react";
import PropTypes from "prop-types";
import { FileText } from "lucide-react";
import EmptyState from "./EmptyState";
import { Button } from "../ui/button";

export default function DocumentList({
  items,
  onOpen,
  emptyTitle,
  emptyDescription,
  actionLabel,
}) {
  if (!items?.length) {
    return (
      <EmptyState
        icon={FileText}
        title={emptyTitle}
        description={emptyDescription}
        compact
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="truncate text-xs text-slate-500">
              {[item.type, item.meta].filter(Boolean).join(" · ")}
            </p>
          </div>
          {item.url && onOpen ? (
            <Button variant="outline" size="sm" onClick={() => onOpen(item)}>
              {actionLabel}
            </Button>
          ) : (
            <span className="text-xs text-slate-400">Indisponible</span>
          )}
        </div>
      ))}
    </div>
  );
}

DocumentList.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      title: PropTypes.string.isRequired,
      type: PropTypes.string,
      meta: PropTypes.string,
      url: PropTypes.string,
    })
  ),
  onOpen: PropTypes.func,
  emptyTitle: PropTypes.string,
  emptyDescription: PropTypes.string,
  actionLabel: PropTypes.string,
};

DocumentList.defaultProps = {
  items: [],
  onOpen: null,
  emptyTitle: "Aucun document disponible",
  emptyDescription: "Les documents disponibles apparaîtront ici.",
  actionLabel: "Ouvrir",
};
