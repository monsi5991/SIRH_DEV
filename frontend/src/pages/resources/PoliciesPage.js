// frontend/src/pages/resources/PoliciesPage.js
import React, { useEffect, useState } from "react";
import { get, post } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { BookOpen, Upload } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function PoliciesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // formulaire création simple (fichier déjà dispo dans /uploads)
  const [form, setForm] = useState({
    title: "",
    category: "",
    version: 1,      // backend attend un Int
    fileUrl: "",
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPolicy = async () => {
    if (!form.title || !form.fileUrl) {
      toast.error("Titre et fichier requis");
      return;
    }
    try {
      await post("/resources/policies", {
        title: form.title,
        category: form.category || null,
        version: Number(form.version) || 1,
        language: "FR",
        content: null,
        fileUrl: form.fileUrl, // on crée directement une version vN avec ce fichier
        effectiveAt: new Date().toISOString(),
      });
      toast.success("Politique créée");
      setForm({ title: "", category: "", version: 1, fileUrl: "" });
      await load();
    } catch (e) {
      toast.error(e?.message || "Échec création");
    }
  };

  const publish = async (id) => {
    try {
      await post(`/resources/policies/${id}/publish`, {});
      toast.success("Politique publiée");
      await load();
    } catch (e) {
      toast.error(e?.message || "Échec publication");
    }
  };

  const acknowledge = async (id) => {
    // “Lu et approuvé” pour l’utilisateur courant si un employeeId est dispo
    const employeeId = user?.employeeId || user?.id; // adapte selon ton mapping User->Employee
    if (!employeeId) {
      toast.error("Aucun employé lié à cet utilisateur");
      return;
    }
    try {
      await post(`/resources/policies/${id}/acknowledge`, {
        employeeId,
        method: "check",
      });
      toast.success("Accusé de lecture enregistré");
      await load();
    } catch (e) {
      toast.error(e?.message || "Échec enregistrement");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Politiques internes</h1>
        <Button variant="outline" onClick={load}>
          Rafraîchir
        </Button>
      </div>

      {/* Création simple */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Nouvelle politique
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-sm text-gray-600">Titre *</label>
            <input
              className="w-full mt-1 border rounded-lg px-3 py-2"
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Catégorie</label>
            <input
              className="w-full mt-1 border rounded-lg px-3 py-2"
              value={form.category}
              onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Version</label>
            <input
              type="number"
              min={1}
              className="w-full mt-1 border rounded-lg px-3 py-2"
              value={form.version}
              onChange={(e) => setForm((s) => ({ ...s, version: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">URL du fichier *</label>
            <input
              className="w-full mt-1 border rounded-lg px-3 py-2"
              placeholder="/uploads/mon_doc.pdf"
              value={form.fileUrl}
              onChange={(e) => setForm((s) => ({ ...s, fileUrl: e.target.value }))}
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <Button onClick={createPolicy}>Créer</Button>
          </div>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Bibliothèque
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : err ? (
            <p className="text-sm text-red-600">{err}</p>
          ) : items.length ? (
            <div className="space-y-3">
              {items.map((p) => {
                const v = p.versions?.[0]; // dernière version renvoyée par l’API
                const status = p.isActive ? "published" : "draft";
                return (
                  <div key={p.id} className="border rounded-lg p-4 hover:shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">
                          {p.title}{" "}
                          <span className="text-gray-500 font-normal">
                            ({v?.version ? `v${v.version}` : "v1"})
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {p.category || "—"} •{" "}
                          {v?.fileUrl ? (
                            <a
                              className="text-blue-600 underline"
                              href={v.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              ouvrir
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={status === "published" ? "secondary" : "outline"}>
                          {status}
                        </Badge>
                        <Badge variant="outline">{p.ackRate ?? 0}% lu</Badge>
                        {!p.isActive && (
                          <Button size="sm" variant="outline" onClick={() => publish(p.id)}>
                            Publier
                          </Button>
                        )}
                        {p.isActive && (
                          <Button size="sm" onClick={() => acknowledge(p.id)}>
                            Je reconnais
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucune politique.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
