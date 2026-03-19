import React from "react";
import PropTypes from "prop-types";
import { UserRound } from "lucide-react";

function clamp(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function polarToCartesian(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildArcPath(cx, cy, r, startDeg, endDeg) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArcFlag = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export function ScorePeopleStrip({ value, slots }) {
  const safe = clamp(value);
  const filled = Math.round((safe / 100) * slots);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: slots }).map((_, i) => (
        <UserRound
          key={`slot-${i + 1}`}
          className={`h-4 w-4 ${i < filled ? "text-indigo-600" : "text-slate-300"}`}
        />
      ))}
    </div>
  );
}

ScorePeopleStrip.propTypes = {
  value: PropTypes.number,
  slots: PropTypes.number,
};

ScorePeopleStrip.defaultProps = {
  value: 0,
  slots: 10,
};

export function GroupedBarChart({
  rows,
  leftKey,
  rightKey,
  leftLabel,
  rightLabel,
  leftColorClass,
  rightColorClass,
  valueFormatter,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const max = Math.max(
    1,
    ...safeRows.map((r) => Math.max(Number(r?.[leftKey]) || 0, Number(r?.[rightKey]) || 0))
  );

  if (!safeRows.length) {
    return <div className="text-sm text-slate-500">Aucune donnée à visualiser.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs">
        <div className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${leftColorClass}`} />
          <span className="text-slate-600">{leftLabel}</span>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${rightColorClass}`} />
          <span className="text-slate-600">{rightLabel}</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[560px]">
          <div className="h-56 border rounded-2xl bg-slate-50/70 p-3">
            <div className="h-full flex items-end gap-3">
              {safeRows.map((row, idx) => {
                const leftValue = Number(row?.[leftKey]) || 0;
                const rightValue = Number(row?.[rightKey]) || 0;
                const leftH = Math.max(6, Math.round((leftValue / max) * 100));
                const rightH = Math.max(6, Math.round((rightValue / max) * 100));
                return (
                  <div key={`bar-row-${idx}`} className="flex-1 min-w-[54px] flex flex-col items-center justify-end">
                    <div className="w-full h-full flex items-end justify-center gap-1.5">
                      <div
                        className={`w-3 rounded-t-md ${leftColorClass}`}
                        style={{ height: `${leftH}%` }}
                        title={`${leftLabel}: ${valueFormatter(leftValue)}`}
                      />
                      <div
                        className={`w-3 rounded-t-md ${rightColorClass}`}
                        style={{ height: `${rightH}%` }}
                        title={`${rightLabel}: ${valueFormatter(rightValue)}`}
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">{row?.label || "-"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {safeRows.map((row, idx) => (
          <div
            key={`legend-row-${idx}`}
            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 flex items-center justify-between"
          >
            <span>{row?.label || "-"}</span>
            <span className="font-medium">
              {valueFormatter(Number(row?.[leftKey]) || 0)} / {valueFormatter(Number(row?.[rightKey]) || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

GroupedBarChart.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object),
  leftKey: PropTypes.string,
  rightKey: PropTypes.string,
  leftLabel: PropTypes.string,
  rightLabel: PropTypes.string,
  leftColorClass: PropTypes.string,
  rightColorClass: PropTypes.string,
  valueFormatter: PropTypes.func,
};

GroupedBarChart.defaultProps = {
  rows: [],
  leftKey: "left",
  rightKey: "right",
  leftLabel: "Série A",
  rightLabel: "Série B",
  leftColorClass: "bg-cyan-500",
  rightColorClass: "bg-orange-500",
  valueFormatter: (v) => String(v),
};

export function SemiGauge({ value, label, subtitle }) {
  const safe = clamp(value);
  const cx = 72;
  const cy = 72;
  const radius = 52;
  const pointerDeg = 180 + safe * 1.8;

  const segments = [
    { from: 0, to: 20, color: "#DC2626" },
    { from: 20, to: 40, color: "#F97316" },
    { from: 40, to: 60, color: "#EAB308" },
    { from: 60, to: 80, color: "#84CC16" },
    { from: 80, to: 100, color: "#22C55E" },
  ];

  const pointerOuter = polarToCartesian(cx, cy, radius - 8, pointerDeg);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="mt-2">
        <svg viewBox="0 0 144 96" className="w-full h-28">
          {segments.map((seg) => {
            const start = 180 + seg.from * 1.8;
            const end = 180 + seg.to * 1.8;
            return (
              <path
                key={`${seg.from}-${seg.to}`}
                d={buildArcPath(cx, cy, radius, start, end)}
                fill="none"
                stroke={seg.color}
                strokeWidth="10"
                strokeLinecap="round"
              />
            );
          })}

          <line
            x1={cx}
            y1={cy}
            x2={pointerOuter.x}
            y2={pointerOuter.y}
            stroke="#111827"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="4.2" fill="#111827" />
        </svg>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <div className="text-xl font-bold text-slate-900">{safe.toFixed(1)}%</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
    </div>
  );
}

SemiGauge.propTypes = {
  value: PropTypes.number,
  label: PropTypes.string,
  subtitle: PropTypes.string,
};

SemiGauge.defaultProps = {
  value: 0,
  label: "Indicateur",
  subtitle: "",
};
