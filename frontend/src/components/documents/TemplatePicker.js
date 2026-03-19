import React, { useEffect, useState, useMemo } from "react";
import PropTypes from "prop-types";
import { Button } from "../ui/button";
import { listTemplates } from "../../lib/documentsApi";

export default function TemplatePicker({ scope = "onboarding", value = [], onChange }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setErr("");
      try {
        const list = await listTemplates(scope);
        if (!mounted) return;
        setItems(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || "Erreur chargement modèles");
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [scope]);

  const selectedSet = useMemo(() => new Set(value || []), [value]);

  const toggle = (idOrName) => {
    const v = new Set(selectedSet);
    if (v.has(idOrName)) v.delete(idOrName); else v.add(idOrName);
    onChange?.(Array.from(v));
  };

  if (loading) return <div className="text-sm text-gray-500">Chargement des modèles…</div>;
  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!items.length) return <div className="text-sm text-gray-500">Aucun modèle disponible.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      {items.map((tpl) => {
        const id = tpl.key || tpl.id || tpl.name;
        const label = tpl.label || tpl.name || id;
        const isSel = selectedSet.has(id);
        return (
          <label
            key={id}
            className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer select-none ${
              isSel ? "bg-emerald-50 border-emerald-200" : "hover:bg-gray-50"
            }`}
          >
            <input
              type="checkbox"
              className="accent-emerald-600"
              checked={isSel}
              onChange={() => toggle(id)}
            />
            <div className="flex-1">
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-gray-500">
                {tpl.country || "SN"} · {tpl.language || "FR"} · {tpl.fileType || "docx"}
              </div>
            </div>
            {isSel && (
              <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); toggle(id); }}>
                Retirer
              </Button>
            )}
          </label>
        );
      })}
    </div>
  );
}

TemplatePicker.propTypes = {
  scope: PropTypes.oneOf(["onboarding", "offboarding"]),
  value: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func,
};
