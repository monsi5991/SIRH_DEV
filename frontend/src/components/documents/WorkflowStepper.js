import React from "react";
import PropTypes from "prop-types";

export default function WorkflowStepper({ steps = [], current = 0 }) {
  const safeIndex = Math.max(0, Math.min(current, steps.length - 1));

  return (
    <div className="w-full">
      {/* traît de progression */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-2 bg-emerald-500 transition-all"
          style={{
            width: steps.length > 1
              ? `${(safeIndex / (steps.length - 1)) * 100}%`
              : "100%"
          }}
        />
      </div>

      {/* puces */}
      <div className="flex justify-between mt-3">
        {steps.map((s, idx) => {
          const done = idx <= safeIndex;
          return (
            <div key={s.key} className="flex flex-col items-center text-center w-full">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  done ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-700"
                }`}
              >
                {idx + 1}
              </div>
              <div className={`mt-1 text-[11px] ${done ? "text-emerald-700" : "text-gray-500"}`}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

WorkflowStepper.propTypes = {
  steps: PropTypes.arrayOf(PropTypes.shape({ key: PropTypes.string, label: PropTypes.string })),
  current: PropTypes.number,
};
