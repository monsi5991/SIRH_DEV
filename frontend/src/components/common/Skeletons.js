import React from "react";
import PropTypes from "prop-types";
import { Skeleton } from "../ui/skeleton";

export function KpiGridSkeleton({ items = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: items }).map((_, idx) => (
        <div key={`kpi-skeleton-${idx}`} className="rounded-xl border bg-white p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-4 h-2 w-full" />
        </div>
      ))}
    </div>
  );
}

KpiGridSkeleton.propTypes = {
  items: PropTypes.number,
};

export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={`list-skeleton-${idx}`} className="rounded-xl border bg-white p-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

ListSkeleton.propTypes = {
  rows: PropTypes.number,
};

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[680px] border-collapse">
        <thead>
          <tr className="bg-gray-50">
            {Array.from({ length: cols }).map((_, c) => (
              <th key={`head-${c}`} className="border px-4 py-3 text-left">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={`row-${r}`}>
              {Array.from({ length: cols }).map((__, c) => (
                <td key={`cell-${r}-${c}`} className="border px-4 py-3">
                  <Skeleton className="h-3 w-full max-w-[120px]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

TableSkeleton.propTypes = {
  rows: PropTypes.number,
  cols: PropTypes.number,
};

export function CardGridSkeleton({ cards = 6 }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: cards }).map((_, idx) => (
        <div key={`card-skeleton-${idx}`} className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

CardGridSkeleton.propTypes = {
  cards: PropTypes.number,
};
