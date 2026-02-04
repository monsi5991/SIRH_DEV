// src/components/operations/BulkBar.jsx
import React from "react";
import { Button } from "../ui/button";
import PropTypes from "prop-types";
import { CheckCircle, XCircle } from "lucide-react";

export default function BulkBar({ count, onApprove, onReject, busy }) {
  if (!count) return null;
  return (
    <div className="sticky bottom-4 mx-auto max-w-5xl rounded-xl border bg-white shadow p-3 flex items-center justify-between" role="region" aria-live="polite">
      <span className="text-sm">{count} sélectionnée{count>1?"s":""}</span>
      <div className="flex gap-2">
        <Button disabled={busy} onClick={onApprove} className="text-green-700 border-green-200 hover:bg-green-50" variant="outline">
          <CheckCircle className="w-4 h-4 mr-1" /> Approuver
        </Button>
        <Button disabled={busy} onClick={onReject} className="text-red-700 border-red-200 hover:bg-red-50" variant="outline">
          <XCircle className="w-4 h-4 mr-1" /> Rejeter
        </Button>
      </div>
    </div>
  );
}
