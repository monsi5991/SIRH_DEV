// src/components/people/EmployeeFormDialog.js
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/button';

const EmployeeSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  site: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  status: z.enum(['ACTIVE','INACTIVE']).default('ACTIVE'),
  joinDate: z.string().optional().nullable(),          // yyyy-mm-dd
  endDate: z.string().optional().nullable(),
  contractType: z.enum(['CDI','CDD','STAGE','INTERIM','APPRENTISSAGE']).optional().nullable(),
  cnss: z.string().optional().nullable(),
  ipres: z.string().optional().nullable(),

  // ✅ Paie
  internalMatricule: z.string().optional().nullable(),
  baseSalary: z.string().optional().nullable(),     // string pour l’input, converti en number au submit
  isCadre: z.boolean().optional(),
  familyParts: z.string().optional().nullable(),
  atRate: z.string().optional().nullable(),
  transportTaxable: z.boolean().optional(),
  bankName: z.string().optional().nullable(),
  bankIban: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable(),
});

export default function EmployeeFormDialog({ open, onClose, onSubmit, initialData = null }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: {
      firstName:'', lastName:'', email:'',
      phone:'', department:'', site:'', position:'',
      status:'ACTIVE', joinDate:'', endDate:'', contractType:'',
      cnss:'', ipres:'',
      // paie
      internalMatricule:'', baseSalary:'',
      isCadre:false, familyParts:'', atRate:'', transportTaxable:false,
      bankName:'', bankIban:'', bankAccount:''
    }
  });

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      reset({
        firstName: initialData.firstName || '',
        lastName: initialData.lastName || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        department: initialData.department || '',
        site: initialData.site || '',
        position: initialData.position || '',
        status: initialData.status || 'ACTIVE',
        joinDate: initialData.joinDate ? String(initialData.joinDate).slice(0,10) : '',
        endDate: initialData.endDate ? String(initialData.endDate).slice(0,10) : '',
        contractType: initialData.contractType || '',
        cnss: initialData.cnss || '',
        ipres: initialData.ipres || '',
        internalMatricule: initialData.internalMatricule || '',
        baseSalary: initialData.baseSalary != null ? String(initialData.baseSalary) : '',
        isCadre: !!initialData.isCadre,
        familyParts: initialData.familyParts != null ? String(initialData.familyParts) : '',
        atRate: initialData.atRate != null ? String(initialData.atRate) : '',
        transportTaxable: !!initialData.transportTaxable,
        bankName: initialData.bankName || '',
        bankIban: initialData.bankIban || '',
        bankAccount: initialData.bankAccount || '',
      });
    } else {
      reset();
    }
  }, [open, initialData, reset]);

  if (!open) return null;

  const onLocalSubmit = (values) => {
    // normalisation paie pour le PATCH backend
    const payload = {
      // RH
      position: values.position || null,
      department: values.department || null,
      site: values.site || null,
      status: values.status,
      joinDate: values.joinDate || null,
      endDate: values.endDate || null,
      contractType: values.contractType || null,
      cnss: values.cnss || null,
      ipres: values.ipres || null,
      // Paie
      internalMatricule: values.internalMatricule || null,
      baseSalary: values.baseSalary === '' ? null : Number(values.baseSalary),
      isCadre: !!values.isCadre,
      familyParts: values.familyParts === '' ? null : Number(values.familyParts),
      atRate: values.atRate === '' ? null : Number(values.atRate),
      transportTaxable: !!values.transportTaxable,
      bankName: values.bankName || null,
      bankIban: values.bankIban || null,
      bankAccount: values.bankAccount || null,
    };
    onSubmit?.(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {initialData ? 'Modifier collaborateur' : 'Nouveau collaborateur'}
          </h2>
          <button onClick={onClose} aria-label="Fermer" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onLocalSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          {/* Identité / job */}
          <div>
            <label className="text-sm text-gray-700">Prénom</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('firstName')} disabled />
            {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName.message}</p>}
          </div>
          <div>
            <label className="text-sm text-gray-700">Nom</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('lastName')} disabled />
            {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName.message}</p>}
          </div>
          <div>
            <label className="text-sm text-gray-700">Email</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" type="email" {...register('email')} disabled />
          </div>
          <div>
            <label className="text-sm text-gray-700">Téléphone</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('phone')} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Département</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('department')} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Site</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('site')} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Poste</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('position')} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Statut</label>
            <select className="mt-1 w-full border rounded-lg px-3 py-2" {...register('status')}>
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-700">Date d’embauche</label>
            <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" {...register('joinDate')} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Fin de contrat</label>
            <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" {...register('endDate')} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Type de contrat</label>
            <select className="mt-1 w-full border rounded-lg px-3 py-2" {...register('contractType')}>
              <option value="">—</option>
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
              <option value="STAGE">Stage</option>
              <option value="INTERIM">Intérim</option>
              <option value="APPRENTISSAGE">Apprentissage</option>
            </select>
          </div>

          {/* Conformité */}
          <div>
            <label className="text-sm text-gray-700">Réf. organisme social</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('cnss')} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Réf. retraite / pension</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('ipres')} />
          </div>

          {/* ✅ Bloc Paie */}
          <div className="md:col-span-2 mt-4">
            <h3 className="font-semibold text-gray-900 mb-2">Rémunération & Paie</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-700">Matricule interne</label>
                <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('internalMatricule')} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Salaire de base (XOF)</label>
                <input type="number" inputMode="numeric" className="mt-1 w-full border rounded-lg px-3 py-2" {...register('baseSalary')} />
              </div>
              <div className="flex items-center gap-2">
                <input id="isCadre" type="checkbox" className="mt-6" {...register('isCadre')} />
                <label htmlFor="isCadre" className="text-sm text-gray-700 mt-5">Cadre</label>
              </div>
              <div>
                <label className="text-sm text-gray-700">Parts familiales</label>
                <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2" {...register('familyParts')} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Taux AT (ex: 0.02)</label>
                <input type="number" step="0.001" className="mt-1 w-full border rounded-lg px-3 py-2" {...register('atRate')} />
              </div>
              <div className="flex items-center gap-2">
                <input id="transportTaxable" type="checkbox" className="mt-6" {...register('transportTaxable')} />
                <label htmlFor="transportTaxable" className="text-sm text-gray-700 mt-5">Transport imposable</label>
              </div>
              <div>
                <label className="text-sm text-gray-700">Banque</label>
                <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('bankName')} />
              </div>
              <div>
                <label className="text-sm text-gray-700">IBAN</label>
                <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('bankIban')} />
              </div>
              <div>
                <label className="text-sm text-gray-700">RIB / Compte</label>
                <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('bankAccount')} />
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
              {initialData ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

EmployeeFormDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onSubmit: PropTypes.func,
  initialData: PropTypes.object,
};
