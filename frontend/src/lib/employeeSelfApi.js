import { del, get, patch, post } from "./api";

export const getEmployeeProfile = () => get("/me/profile");
export const updateEmployeeProfileSection = (section, values) =>
  patch("/me/profile", { section, values });

export const listEmployeeRequests = (params = {}) =>
  get("/requests/hr", { params });
export const getEmployeeRequest = (id) => get(`/requests/hr/${id}`);
export const createEmployeeRequest = (body) => post("/requests/hr", body);
export const cancelEmployeeRequest = (id, body = {}) => post(`/requests/hr/${id}/cancel`, body);
export const addEmployeeRequestComment = (id, body) => post(`/requests/hr/${id}/comments`, body);

export const listEmployeePolicies = (params = {}) =>
  get("/resources/policies", { params });
export const acknowledgeEmployeePolicy = (id, employeeId, method = "check") =>
  post(`/resources/policies/${id}/acknowledge`, { employeeId, method });

export const listEmployeeDocuments = (params = {}) =>
  get("/me/documents", { params });

export const listEmployeePayslips = (period) =>
  get("/payroll/my/slips", { params: period ? { period } : undefined });
export const getEmployeePayslipPreview = (period) =>
  get("/payroll/my/preview", { params: period ? { period } : undefined });

export const uploadEmployeeRequestAttachment = (formData) =>
  post("/requests/hr/attachments", formData);
export const deleteEmployeeRequestAttachment = (fileId) =>
  del(`/requests/hr/attachments/${fileId}`);
