// src/pages/people/AnnuairePage.js
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useApp } from '../../contexts/AppContext';
import { Users, Search, Plus, Mail, Phone, MapPin, Eye, Edit, User, X, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Avatar } from '../../components/ui/avatar';
import {
  useEmployees, useEmployeeDetail,
  createEmployee as apiCreateEmployee,
  updateEmployee as apiUpdateEmployee,
  uploadEmployeeDocument
} from '../../hooks/useEmployees';
import EmployeeFormDialog from '../../components/people/EmployeeFormDialog';
import { emitEmployeesChanged, emitRefreshCounters } from '../../lib/events';

/* ===============================
 * Profil 360 (panneau modal)
 * =============================== */
function EmployeeProfile360({ employeeId, onClose }) {
  const ref = useRef(null);
  const { employee, loading, error, setEmployee } = useEmployeeDetail(employeeId);

  useEffect(() => {
    if (!employeeId) return;
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [employeeId, onClose]);

  if (!employeeId) return null;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const doc = await uploadEmployeeDocument(employeeId, { file, label: file.name, type: 'autre' });
      const base = employee ?? {};
      const docs = Array.isArray(base.documents) ? base.documents : [];
      setEmployee({ ...base, documents: [doc, ...docs] });
      emitEmployeesChanged({ action: 'doc_upload', employeeId });
    } catch (err) {
      alert(err.message);
    } finally {
      e.target.value = '';
    }
  };

  const fmt = (n) => new Intl.NumberFormat("fr-FR").format(n ?? 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-dialog-title"
        tabIndex={-1}
        ref={ref}
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto outline-none"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 bg-emerald-600">
                <div className="w-full h-full bg-emerald-600 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
              </Avatar>
              <div>
                <h2 id="employee-dialog-title" className="text-2xl font-bold text-gray-900">
                  {loading ? 'Chargement…' : (employee ? `${employee.firstName} ${employee.lastName}` : '—')}
                </h2>
                <p className="text-gray-600">{loading ? '—' : (employee?.position || '—')}</p>
                <p className="text-sm text-gray-500">{loading ? '—' : (employee?.department || '—')}</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Fermer" className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informations personnelles */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Informations personnelles</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {error && <p className="text-sm text-red-600">{String(error)}</p>}
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{employee?.email || '—'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{employee?.phone || '—'}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{employee?.site || '—'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Contrat & conformité */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Contrat & conformité</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Date d’embauche :</span>
                <div className="font-medium">
                  {employee?.joinDate ? new Date(employee.joinDate).toLocaleDateString() : '—'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Statut :</span>
                <Badge className={employee?.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {employee?.status === 'ACTIVE' ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
              {employee?.cnss && (<div><span className="text-sm text-gray-600">CNSS :</span> <span className="font-medium">{employee.cnss}</span></div>)}
              {employee?.ipres && (<div><span className="text-sm text-gray-600">IPRES :</span> <span className="font-medium">{employee.ipres}</span></div>)}
            </CardContent>
          </Card>

          {/* ✅ Rémunération & Paie (optionnel) */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Rémunération & Paie</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Salaire de base</div>
                <div className="font-medium">
                  {employee?.baseSalary != null ? `${fmt(employee.baseSalary)} XOF` : "—"}
                </div>
              </div>

              {employee?.transportTaxable != null && (
                <div>
                  <div className="text-gray-500">Transport imposable</div>
                  <div className="font-medium">{employee.transportTaxable ? "Oui" : "Non"}</div>
                </div>
              )}
              {employee?.familyParts != null && (
                <div>
                  <div className="text-gray-500">Parts famille</div>
                  <div className="font-medium">{employee.familyParts}</div>
                </div>
              )}
              {employee?.atRate != null && (
                <div>
                  <div className="text-gray-500">Taux AT</div>
                  <div className="font-medium">{(employee.atRate * 100).toFixed(2)}%</div>
                </div>
              )}
              {(employee?.bankName || employee?.bankIban) && (
                <>
                  <div>
                    <div className="text-gray-500">Banque</div>
                    <div className="font-medium">{employee.bankName || "—"}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">IBAN / RIB</div>
                    <div className="font-medium break-all">{employee.bankIban || "—"}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-lg">Documents</CardTitle>
              <label className="inline-flex items-center gap-2 text-sm text-emerald-700 cursor-pointer">
                <Upload className="w-4 h-4" /> Ajouter
                <input type="file" className="hidden" onChange={handleUpload} />
              </label>
            </CardHeader>
            <CardContent>
              {!employee?.documents?.length ? (
                <p className="text-sm text-gray-500">Aucun document</p>
              ) : (
                <div className="space-y-2">
                  {employee.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-sm underline">{d.label}</a>
                      <span className="text-xs text-gray-500">
                        {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Objectifs */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Objectifs récents</CardTitle></CardHeader>
            <CardContent>
              {!employee?.goals?.length ? (
                <p className="text-sm text-gray-500">Aucun objectif</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {employee.goals.map((g) => (
                    <li key={g.id} className="flex items-center justify-between">
                      <span className="truncate">{g.title}</span>
                      <Badge>{g.progress}%</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

EmployeeProfile360.propTypes = {
  employeeId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};

/* ===============================
 * Page Annuaire principale
 * =============================== */
export default function AnnuairePage() {
  const { t } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ country: 'SN', department: '', site: '', status: '' });
  const [page, setPage] = useState(1);
  const { items: employees, total, loading, error, refetch } = useEmployees({
    search: searchQuery,
    ...filters,
    page,
    pageSize: 12
  });
  const totalPages = Math.max(1, Math.ceil(total / 12));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);

  const handleCreateClick = () => { setEditEmployee(null); setFormOpen(true); };
  const handleEditClick = (emp) => { setEditEmployee(emp); setFormOpen(true); };

  const handleFormSubmit = async (values) => {
    try {
      if (editEmployee) await apiUpdateEmployee(editEmployee.id, values);
      else await apiCreateEmployee(values);
      setFormOpen(false);
      setEditEmployee(null);
      await refetch();
      emitEmployeesChanged({ action: editEmployee ? 'update' : 'create' });
      emitRefreshCounters();
    } catch (e) {
      alert(e?.message || 'Erreur lors de la sauvegarde');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('directory.title') || 'Annuaire des employés'}</h1>
          <p className="text-gray-600 mt-1">Gérez les informations de vos employés</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateClick}>
          <Plus className="w-4 h-4 mr-2" /> Ajouter un employé
        </Button>
      </div>

      {/* Filtres & recherche */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('directory.searchEmployee') || 'Rechercher un collaborateur'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                className="border rounded-lg px-3 py-2"
                value={filters.department}
                onChange={e => { setPage(1); setFilters(f => ({ ...f, department: e.target.value === 'Tous' ? '' : e.target.value })); }}
              >
                {['Tous', 'RH', 'Finance', 'Operations', 'IT'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select
                className="border rounded-lg px-3 py-2"
                value={filters.site}
                onChange={e => { setPage(1); setFilters(f => ({ ...f, site: e.target.value === 'Tous' ? '' : e.target.value })); }}
              >
                {['Tous', 'Dakar', 'Thiès', 'Saint-Louis'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                className="border rounded-lg px-3 py-2"
                value={filters.status}
                onChange={e => { setPage(1); setFilters(f => ({ ...f, status: e.target.value })); }}
              >
                <option value="">Tous statuts</option>
                <option value="ACTIVE">Actif</option>
                <option value="INACTIVE">Inactif</option>
              </select>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{String(error)}</p>}
        </CardContent>
      </Card>

      {/* Liste + pagination */}
      {loading ? (
        <p className="text-sm text-gray-500">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {employees.map((e) => (
              <Card key={e.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="w-12 h-12 bg-emerald-600">
                      <div className="w-full h-full bg-emerald-600 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{e.firstName} {e.lastName}</h3>
                      <p className="text-sm text-gray-600 truncate">{e.position || '—'}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>{e.department || '—'} • {e.site || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{e.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>{e.phone || '—'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedEmployeeId(e.id)} className="flex-1">
                      <Eye className="w-4 h-4 mr-2" /> Profil 360
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleEditClick(e)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Préc.</Button>
            <span className="text-sm text-gray-600">Page {page} / {totalPages}</span>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Suiv.</Button>
          </div>
        </>
      )}

      {!loading && employees.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="font-medium mb-2">Aucun employé trouvé</h3>
          <p className="text-sm">Essayez d’ajuster la recherche ou les filtres</p>
        </div>
      )}

      {/* Dialog créer/modifier */}
      <EmployeeFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditEmployee(null); }}
        onSubmit={handleFormSubmit}
        initialData={editEmployee}
      />

      {/* Panneau Profil 360 */}
      <EmployeeProfile360 employeeId={selectedEmployeeId} onClose={() => setSelectedEmployeeId(null)} />
    </div>
  );
}
