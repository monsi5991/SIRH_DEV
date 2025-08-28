import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "../ui/button";

export default function EmployeeForm({ initialData = {}, onSubmit, loading = false }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName:  "",
    email:     "",
    position:  "",
    department:"",
    site:      "",
    baseSalary: "", // string pour l'input, converti au submit
    ...initialData,
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      ...initialData,
      baseSalary: initialData.baseSalary ?? "", // garde string vide si null/undefined
    }));
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // on laisse le navigateur valider le number; on nettoie seulement les espaces
    setForm(prev => ({ ...prev, [name]: name === "baseSalary" ? value.replace(/\s+/g, "") : value }));
  };

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      position:   form.position || null,
      department: form.department || null,
      site:       form.site || null,
      // seul champ sensible côté RH pour la paie :
      baseSalary: form.baseSalary === "" ? null : Number(form.baseSalary),
    };
    onSubmit?.(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600">Prénom</label>
          <input name="firstName" value={form.firstName} disabled
                 className="mt-1 w-full border rounded-lg px-3 py-2 bg-gray-50" />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Nom</label>
          <input name="lastName" value={form.lastName} disabled
                 className="mt-1 w-full border rounded-lg px-3 py-2 bg-gray-50" />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Email</label>
          <input type="email" name="email" value={form.email} disabled
                 className="mt-1 w-full border rounded-lg px-3 py-2 bg-gray-50" />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Poste</label>
          <input name="position" value={form.position || ""} onChange={handleChange}
                 className="mt-1 w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Département</label>
          <input name="department" value={form.department || ""} onChange={handleChange}
                 className="mt-1 w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Site</label>
          <input name="site" value={form.site || ""} onChange={handleChange}
                 className="mt-1 w-full border rounded-lg px-3 py-2" />
        </div>

        {/* ✅ Salaire de base */}
        <div>
          <label className="block text-sm text-gray-600">Salaire de base (XOF)</label>
          <input
            type="number"
            inputMode="numeric"
            name="baseSalary"
            placeholder="ex: 450000"
            value={form.baseSalary}
            onChange={handleChange}
            className="mt-1 w-full border rounded-lg px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Laisser vide pour garder le fallback démo si non renseigné.
          </p>
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

EmployeeForm.propTypes = {
  initialData: PropTypes.object,
  onSubmit: PropTypes.func,
  loading: PropTypes.bool,
};
