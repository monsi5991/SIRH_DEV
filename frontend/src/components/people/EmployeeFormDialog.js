// frontend/src/components/people/EmployeeFormDialog.js
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
  contractType: z.enum(['CDI','CDD','STAGE','INTERIM','APPRENTISSAGE']).optional().nullable(),
  cnss: z.string().optional().nullable(),
  ipres: z.string().optional().nullable(),
});

export default function EmployeeFormDialog({
  open,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: {
      firstName: '', lastName: '', email: '',
      phone: '', department: '', site: '', position: '',
      status: 'ACTIVE', joinDate: '', contractType: '',
      cnss: '', ipres: ''
    }
  });

  useEffect(() => {
    if (open) {
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
          contractType: initialData.contractType || '',
          cnss: initialData.cnss || '',
          ipres: initialData.ipres || '',
        });
      } else {
        reset();
      }
    }
  }, [open, initialData, reset]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {initialData ? 'Modifier collaborateur' : 'Nouveau collaborateur'}
          </h2>
          <button onClick={onClose} aria-label="Fermer" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6"
        >
          <div>
            <label className="text-sm text-gray-700">Prénom</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('firstName')} />
            {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName.message}</p>}
          </div>

          <div>
            <label className="text-sm text-gray-700">Nom</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('lastName')} />
            {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName.message}</p>}
          </div>

          <div>
            <label className="text-sm text-gray-700">Email</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
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

          <div>
            <label className="text-sm text-gray-700">CNSS</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('cnss')} />
          </div>

          <div>
            <label className="text-sm text-gray-700">IPRES</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('ipres')} />
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
