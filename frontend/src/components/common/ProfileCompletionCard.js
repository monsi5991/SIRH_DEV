import React from "react";
import PropTypes from "prop-types";
import { Progress } from "../ui/progress";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export default function ProfileCompletionCard({
  percent,
  missingFields,
  lastUpdatedAt,
  onPrimaryAction,
}) {
  return (
    <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-900">Complétude du profil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-3xl font-semibold text-slate-900">{percent}%</div>
            <p className="text-sm text-slate-600">
              {missingFields.length
                ? `${missingFields.length} information(s) à compléter`
                : "Profil complet"}
            </p>
          </div>
          {lastUpdatedAt ? (
            <p className="text-xs text-slate-500">Mis à jour le {lastUpdatedAt}</p>
          ) : null}
        </div>
        <Progress value={percent} className="h-2 bg-emerald-100" />
        {missingFields.length ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">À compléter</p>
            <div className="flex flex-wrap gap-2">
              {missingFields.map((field) => (
                <span key={field} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs text-amber-800">
                  {field}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {onPrimaryAction ? (
          <Button variant="outline" size="sm" onClick={onPrimaryAction}>
            Mettre à jour mon profil
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

ProfileCompletionCard.propTypes = {
  percent: PropTypes.number,
  missingFields: PropTypes.arrayOf(PropTypes.string),
  lastUpdatedAt: PropTypes.string,
  onPrimaryAction: PropTypes.func,
};

ProfileCompletionCard.defaultProps = {
  percent: 0,
  missingFields: [],
  lastUpdatedAt: "",
  onPrimaryAction: null,
};
