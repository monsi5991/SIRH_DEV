import React from "react";
import PropTypes from "prop-types";

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function MiniBarChart({
  data,
  valueKey,
  labelKey,
  maxBars,
  height,
  colorClassName,
  valueFormatter,
}) {
  const rows = Array.isArray(data) ? data.slice(0, maxBars) : [];
  const values = rows.map((r) => toNumber(r?.[valueKey]));
  const max = Math.max(1, ...values);

  if (!rows.length) {
    return <div className="text-xs text-gray-500">Aucune donnée disponible.</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2" style={{ height: `${height}px` }}>
        {rows.map((row, idx) => {
          const value = toNumber(row?.[valueKey]);
          const ratio = Math.max(0.05, value / max);
          return (
            <div key={`${row?.[labelKey] || "v"}-${idx}`} className="flex-1 min-w-0 flex flex-col items-center justify-end">
              <div
                className={`w-full rounded-t-md ${colorClassName}`}
                style={{ height: `${Math.round(ratio * 100)}%` }}
                title={`${row?.[labelKey] || "N/A"}: ${valueFormatter(value)}`}
              />
              <div className="mt-1 text-[10px] text-gray-500 truncate w-full text-center">
                {String(row?.[labelKey] || "-")}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((row, idx) => {
          const value = toNumber(row?.[valueKey]);
          return (
            <div key={`legend-${idx}`} className="text-[11px] text-gray-600 flex items-center justify-between border rounded px-2 py-1">
              <span className="truncate mr-2">{String(row?.[labelKey] || "-")}</span>
              <span className="font-medium">{valueFormatter(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

MiniBarChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object),
  valueKey: PropTypes.string,
  labelKey: PropTypes.string,
  maxBars: PropTypes.number,
  height: PropTypes.number,
  colorClassName: PropTypes.string,
  valueFormatter: PropTypes.func,
};

MiniBarChart.defaultProps = {
  data: [],
  valueKey: "value",
  labelKey: "label",
  maxBars: 8,
  height: 130,
  colorClassName: "bg-emerald-500",
  valueFormatter: (v) => String(v),
};

export function MiniLineChart({
  data,
  valueKey,
  labelKey,
  height,
  stroke,
  areaFill,
  valueFormatter,
}) {
  const rows = Array.isArray(data) ? data : [];
  const values = rows.map((r) => toNumber(r?.[valueKey]));

  if (!rows.length || values.length < 2) {
    return <div className="text-xs text-gray-500">Aucune série exploitable.</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1e-9, max - min);
  const width = 100;
  const chartHeight = 52;

  const points = values.map((v, idx) => {
    const x = (idx / (values.length - 1)) * width;
    const y = chartHeight - ((v - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const areaPoints = `0,${chartHeight} ${points.join(" ")} ${width},${chartHeight}`;

  return (
    <div className="space-y-2">
      <div className="w-full rounded-md bg-gray-50 border px-2 py-2">
        <svg viewBox={`0 0 ${width} ${chartHeight}`} preserveAspectRatio="none" className="w-full" style={{ height: `${height}px` }}>
          <polyline points={areaPoints} fill={areaFill} stroke="none" />
          <polyline points={points.join(" ")} fill="none" stroke={stroke} strokeWidth="1.8" />
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {rows.slice(-6).map((row, idx) => (
          <div key={`line-row-${idx}`} className="text-[11px] text-gray-600 flex items-center justify-between border rounded px-2 py-1">
            <span className="truncate mr-2">{String(row?.[labelKey] || "-")}</span>
            <span className="font-medium">{valueFormatter(toNumber(row?.[valueKey]))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

MiniLineChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object),
  valueKey: PropTypes.string,
  labelKey: PropTypes.string,
  height: PropTypes.number,
  stroke: PropTypes.string,
  areaFill: PropTypes.string,
  valueFormatter: PropTypes.func,
};

MiniLineChart.defaultProps = {
  data: [],
  valueKey: "value",
  labelKey: "label",
  height: 120,
  stroke: "#0F766E",
  areaFill: "rgba(15, 118, 110, 0.12)",
  valueFormatter: (v) => String(v),
};
