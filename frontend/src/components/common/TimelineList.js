import React from "react";
import PropTypes from "prop-types";
import { Clock3 } from "lucide-react";
import StatusBadge from "./StatusBadge";
import EmptyState from "./EmptyState";

export default function TimelineList({
  items,
  emptyTitle,
  emptyDescription,
  onSelect,
}) {
  if (!items?.length) {
    return (
      <EmptyState
        icon={Clock3}
        title={emptyTitle}
        description={emptyDescription}
        compact
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const content = (
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                {item.description ? <p className="text-sm text-slate-600">{item.description}</p> : null}
              </div>
              {item.status ? <StatusBadge status={item.status} label={item.statusLabel} /> : null}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {item.meta ? <span>{item.meta}</span> : null}
              {item.submeta ? <span>{item.submeta}</span> : null}
            </div>
          </div>
        );

        if (!onSelect) return <div key={item.id}>{content}</div>;

        return (
          <button
            key={item.id}
            type="button"
            className="w-full text-left"
            onClick={() => onSelect(item)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

TimelineList.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
      description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
      meta: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
      submeta: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
      status: PropTypes.string,
      statusLabel: PropTypes.string,
    })
  ),
  emptyTitle: PropTypes.string,
  emptyDescription: PropTypes.string,
  onSelect: PropTypes.func,
};

TimelineList.defaultProps = {
  items: [],
  emptyTitle: "Aucun élément à afficher",
  emptyDescription: "Les prochains éléments apparaîtront ici.",
  onSelect: null,
};
