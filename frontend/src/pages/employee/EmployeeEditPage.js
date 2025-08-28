// src/pages/employee/EmployeeEditPage.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { get, patch } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import EmployeeForm from "../../components/people/EmployeeForm";

export default function EmployeeEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await get(`/people/employees/${id}`)   // <- route people/employees (backend corrigé)
        .catch(async () => await get(`/employees/${id}`)); // <- fallback si ancien endpoint
      if (!data || !data.id) {
        setNotFound(true);
        setEmp(null);
      } else {
        setEmp(data);
      }
    } catch (e) {
      setNotFound(true);
      setEmp(null);
      toast.error("Impossible de charger l'employé");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onSubmit = async (payload) => {
    if (!id) return;
    setSaving(true);
    try {
      // même logique “nouvelle route + fallback”
      await patch(`/people/employees/${id}`, payload).catch(async () => {
        await patch(`/employees/${id}`, payload);
      });
      toast.success("Employé mis à jour");
      window.dispatchEvent(new Event("employees:changed"));
      navigate(-1);
    } catch (e) {
      toast.error("Échec de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  // — Rendus sûrs (ne jamais accéder à emp.firstName sans null-check) —
  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-500">
        Chargement du profil employé…
      </div>
    );
  }

  if (notFound || !emp) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Employé introuvable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-4">
            <p>L’employé demandé n’existe pas ou n’est plus disponible.</p>
            <Button variant="outline" onClick={() => navigate(-1)}>Retour</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // — Page principale —
  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <CardTitle>
            Modifier l’employé — {emp.firstName} {emp.lastName}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Retour</Button>
          </div>
        </CardHeader>

        <CardContent>
          <EmployeeForm initialData={emp} onSubmit={onSubmit} loading={saving} />
        </CardContent>
      </Card>
    </div>
  );
}
