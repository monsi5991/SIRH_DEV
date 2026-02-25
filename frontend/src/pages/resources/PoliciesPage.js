import React, { useEffect, useState } from "react";
import { z } from "zod";
import { get, post } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { BookOpen, Upload } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const PolicySchema = z.object({
  title: z.string().min(3, "Titre requis"),
  category: z.string().optional(),
  version: z.coerce.number().int().min(1, "Version >= 1"),
  language: z.enum(["FR", "EN"]).default("FR"),
  effectiveAt: z.string().min(1, "Date d’effet requise"),
  fileUrl: z.string().optional(),
  content: z.string().optional(),
  owner: z.string().optional(),
  audience: z.string().optional(),
  ackReminderDays: z.union([z.literal(""), z.coerce.number().int().min(1)]).optional(),
});

export default function PoliciesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    title: "",
    category: "",
    version: 1,
    language: "FR",
    effectiveAt: new Date().toISOString().slice(0, 10),
    fileUrl: "",
    content: "",
    owner: "",
    audience: "",
    ackReminderDays: "",
  });

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await get("/resources/policies");
      setItems(Array.isArray(r?.items) ? r.items : []);
    } catch (e) {
      setErr(e?.message || "Erreur chargement politiques");
      setItems([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createPolicy = async () => {
    const parsed = PolicySchema.safeParse(form);
    if (!parsed.success) {
      const next = {};
      parsed.error.issues.forEach((i) => { next[i.path[0]] = i.message; });
      setErrors(next);
      toast.error("Vérifiez les champs du formulaire");
      return;
    }
    if (!parsed.data.fileUrl && !parsed.data.content) {
      toast.error("Fournir soit un contenu, soit une URL de fichier.");
      return;
    }
    try {
      await post("/resources/policies", {
        title: parsed.data.title,
        category: parsed.data.category || null,
        version: parsed.data.version,
        language: parsed.data.language,
        content: parsed.data.content || null,
        fileUrl: parsed.data.fileUrl || null,
        effectiveAt: new Date(parsed.data.effectiveAt).toISOString(),
      });
      toast.success("Politique créée");
      setErrors({});
      setForm({ title: "", category: "", version: 1, language: "FR", effectiveAt: new Date().toISOString().slice(0, 10), fileUrl: "", content: "", owner: "", audience: "", ackReminderDays: "" });
      await load();
    } catch (e) { toast.error(e?.message || "Échec création"); }
  };

  const publish = async (id) => {
    try { await post(`/resources/policies/${id}/publish`, {}); toast.success("Politique publiée"); await load(); }
    catch (e) { toast.error(e?.message || "Échec publication"); }
  };

  const acknowledge = async (id) => {
    const employeeId = user?.employeeId || user?.id;
    if (!employeeId) { toast.error("Aucun employé lié à cet utilisateur"); return; }
    try { await post(`/resources/policies/${id}/acknowledge`, { employeeId, method: "check" }); toast.success("Accusé de lecture enregistré"); await load(); }
    catch (e) { toast.error(e?.message || "Échec enregistrement"); }
  };

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-gray-900">Politiques internes</h1><Button variant="outline" onClick={load}>Rafraîchir</Button></div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> Nouvelle politique (enrichie)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="border rounded-lg px-3 py-2" placeholder="Titre *" value={form.title} onChange={(e) => set("title", e.target.value)} />
          <input className="border rounded-lg px-3 py-2" placeholder="Catégorie" value={form.category} onChange={(e) => set("category", e.target.value)} />
          <input type="number" min={1} className="border rounded-lg px-3 py-2" placeholder="Version" value={form.version} onChange={(e) => set("version", e.target.value)} />
          <select className="border rounded-lg px-3 py-2" value={form.language} onChange={(e) => set("language", e.target.value)}><option value="FR">FR</option><option value="EN">EN</option></select>
          <input type="date" className="border rounded-lg px-3 py-2" value={form.effectiveAt} onChange={(e) => set("effectiveAt", e.target.value)} />
          <input className="border rounded-lg px-3 py-2" placeholder="URL fichier" value={form.fileUrl} onChange={(e) => set("fileUrl", e.target.value)} />
          <input className="border rounded-lg px-3 py-2" placeholder="Owner (métier)" value={form.owner} onChange={(e) => set("owner", e.target.value)} />
          <input className="border rounded-lg px-3 py-2" placeholder="Audience (métier)" value={form.audience} onChange={(e) => set("audience", e.target.value)} />
          <input type="number" min={1} className="border rounded-lg px-3 py-2" placeholder="Rappel ack (jours)" value={form.ackReminderDays} onChange={(e) => set("ackReminderDays", e.target.value)} />
          <textarea className="md:col-span-3 border rounded-lg px-3 py-2" rows={4} placeholder="Contenu (si pas de fichier)" value={form.content} onChange={(e) => set("content", e.target.value)} />
          {Object.keys(errors).length > 0 && <p className="md:col-span-3 text-xs text-red-600">{Object.values(errors)[0]}</p>}
          <div className="md:col-span-3 flex justify-end"><Button onClick={createPolicy}>Créer</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5" /> Bibliothèque</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-gray-500">Chargement…</p> : err ? <p className="text-sm text-red-600">{err}</p> : items.length ? (
            <div className="space-y-3">
              {items.map((p) => {
                const v = p.versions?.[0];
                return (
                  <div key={p.id} className="border rounded-lg p-4 hover:shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{p.title} <span className="text-gray-500 font-normal">({v?.version ? `v${v.version}` : "v1"})</span></div>
                        <div className="text-xs text-gray-500">{p.category || "—"} • {v?.fileUrl ? <a className="text-blue-600 underline" href={v.fileUrl} target="_blank" rel="noreferrer">ouvrir</a> : "—"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.isActive ? "secondary" : "outline"}>{p.isActive ? "published" : "draft"}</Badge>
                        <Badge variant="outline">{p.ackRate ?? 0}% lu</Badge>
                        {!p.isActive ? <Button size="sm" variant="outline" onClick={() => publish(p.id)}>Publier</Button> : <Button size="sm" onClick={() => acknowledge(p.id)}>Je reconnais</Button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-gray-500">Aucune politique.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
