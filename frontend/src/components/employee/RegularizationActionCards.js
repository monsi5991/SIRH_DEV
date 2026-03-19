import React from "react";
import PropTypes from "prop-types";
import ActionCard from "../common/ActionCard";
import EmptyState from "../common/EmptyState";

export default function RegularizationActionCards({ groups }) {
  if (!groups.length) {
    return (
      <EmptyState
        title="Aucune action immédiate"
        description="Aucune correction prioritaire n'est actuellement détectée."
        compact
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {groups.map((group) => (
        <ActionCard
          key={group.id}
          icon={group.icon}
          title={group.actionTitle}
          description={group.actionDescription}
          primaryActionLabel={group.primaryActionLabel}
          onPrimaryAction={group.onPrimaryAction}
          secondaryActionLabel={group.secondaryActionLabel}
          onSecondaryAction={group.onSecondaryAction}
          footer={(
            <div className="space-y-2">
              <div className="inline-flex rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-600">
                {group.count} cas
              </div>
              {Array.isArray(group.previewItems) && group.previewItems.length ? (
                <div className="space-y-2">
                  {group.previewItems.slice(0, 2).map((item) => (
                    <div key={item.id} className="rounded-xl border border-white/80 bg-white/90 px-3 py-2">
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      {item.meta ? <p className="text-xs text-slate-500">{item.meta}</p> : null}
                    </div>
                  ))}
                  {group.remainingCount > 0 ? (
                    <p className="text-xs text-slate-500">+ {group.remainingCount} autre(s) élément(s)</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          tone={group.tone}
        />
      ))}
    </div>
  );
}

RegularizationActionCards.propTypes = {
  groups: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      icon: PropTypes.elementType,
      actionTitle: PropTypes.string.isRequired,
      actionDescription: PropTypes.string.isRequired,
      count: PropTypes.number,
      primaryActionLabel: PropTypes.string,
      onPrimaryAction: PropTypes.func,
      secondaryActionLabel: PropTypes.string,
      onSecondaryAction: PropTypes.func,
      previewItems: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
          title: PropTypes.string.isRequired,
          meta: PropTypes.string,
        })
      ),
      remainingCount: PropTypes.number,
      tone: PropTypes.oneOf(["neutral", "success", "warning", "danger", "info"]),
    })
  ),
};

RegularizationActionCards.defaultProps = {
  groups: [],
};
