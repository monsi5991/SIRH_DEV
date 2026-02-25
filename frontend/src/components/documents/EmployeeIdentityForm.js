import React from "react";
import PropTypes from "prop-types";

export default function EmployeeIdentityForm({ employee, setEmployee, extraField }) {
  const set = (k, v) => setEmployee((s) => ({ ...s, [k]: v }));
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      <div>
        <label className="text-sm text-gray-600">Prénom *</label>
        <input className="w-full mt-1 border rounded-lg px-3 py-2" value={employee.firstName} onChange={(e) => set("firstName", e.target.value)} />
      </div>
      <div>
        <label className="text-sm text-gray-600">Nom *</label>
        <input className="w-full mt-1 border rounded-lg px-3 py-2" value={employee.lastName} onChange={(e) => set("lastName", e.target.value)} />
      </div>
      <div>
        <label className="text-sm text-gray-600">Email *</label>
        <input type="email" className="w-full mt-1 border rounded-lg px-3 py-2" value={employee.email} onChange={(e) => set("email", e.target.value)} />
      </div>
      <div>
        <label className="text-sm text-gray-600">Manager</label>
        <input className="w-full mt-1 border rounded-lg px-3 py-2" value={employee.manager || ""} onChange={(e) => set("manager", e.target.value)} />
      </div>
      <div>
        <label className="text-sm text-gray-600">{extraField?.label || "Position"}</label>
        <input className="w-full mt-1 border rounded-lg px-3 py-2" value={employee[extraField?.key || "position"] || ""} onChange={(e) => set(extraField?.key || "position", e.target.value)} />
      </div>
    </div>
  );
}

EmployeeIdentityForm.propTypes = {
  employee: PropTypes.object.isRequired,
  setEmployee: PropTypes.func.isRequired,
  extraField: PropTypes.shape({ key: PropTypes.string, label: PropTypes.string }),
};
