import React from "react";
import PropTypes from "prop-types";

export default function Checklist({ title, items = [], onToggle }) {
  return (
    <div className="border rounded-lg p-3">
      {title && <div className="text-sm font-medium mb-2 text-gray-700">{title}</div>}
      <div className="space-y-2">
        {items.map((it) => (
          <label
            key={it.key}
            className="flex items-center gap-2 text-sm cursor-pointer select-none"
          >
            <input
              type="checkbox"
              className="accent-emerald-600"
              checked={!!it.done}
              onChange={() => onToggle?.(it)}
            />
            <span className={it.done ? "line-through text-gray-400" : "text-gray-800"}>
              {it.label}
            </span>
            {it.hint && <span className="text-xs text-gray-500 ml-1">({it.hint})</span>}
          </label>
        ))}
        {!items.length && <div className="text-xs text-gray-500">Aucun élément.</div>}
      </div>
    </div>
  );
}

Checklist.propTypes = {
  title: PropTypes.string,
  items: PropTypes.arrayOf(
    PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, done: PropTypes.bool, hint: PropTypes.string })
  ),
  onToggle: PropTypes.func,
};
