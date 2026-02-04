// src/features/leaves/api/leaves.client.js
import { get, post, put } from "../../../lib/api";

export const LeavesAPI = {
  list: (params) => get("/operations/leaves" + toQuery(params ?? {})),

  // Détails avec fallback si le backend n'a pas encore /:id
  one: async (id) => {
    try {
      const d = await get(`/operations/leaves/${id}`);
      // accepte 2 formats: { leave, logs } OU directement l'objet leave
      if (d && d.leave) return d;
      if (d && d.id) return { leave: d, logs: [] };
      return { leave: null, logs: [] };
    } catch (e) {
      if (e?.status === 404) {
        // fallback: on liste et on retrouve côté client
        const list = await get("/operations/leaves");
        const rows = Array.isArray(list?.leaves) ? list.leaves : Array.isArray(list) ? list : [];
        const found = rows.find((r) => r.id === id) || null;
        return { leave: found, logs: [] };
      }
      throw e;
    }
  },

  comments: {
    list: async (id) => {
      try {
        const d = await get(`/operations/leaves/${id}/comments`);
        return { comments: Array.isArray(d?.comments) ? d.comments : [] };
      } catch (e) {
        if (e?.status === 404) return { comments: [] }; // endpoint pas encore créé → on n’affiche rien
        throw e;
      }
    },
    add: async (id, message) => {
      try {
        const d = await post(`/operations/leaves/${id}/comments`, { message });
        return d;
      } catch (e) {
        if (e?.status === 404) {
          // si pas d’endpoint, on simule un commentaire local minimal
          return {
            comment: {
              id: `local-${Date.now()}`,
              leaveId: id,
              message,
              createdAt: new Date().toISOString(),
            },
          };
        }
        throw e;
      }
    },
  },

  exportCsv: (params) => get("/operations/leaves/export.csv" + toQuery(params ?? {})),
  stats: (params) => get("/operations/leaves/stats" + toQuery(params ?? {})),
  validate: (body) => post("/operations/leaves/validate", body),
  bulkStatus: (ids, status, reason) => put("/operations/leaves/bulk-status", { ids, status, reason }),
};

function toQuery(obj) {
  const s = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => (v != null && v !== "") && s.append(k, String(v)));
  const qs = s.toString();
  return qs ? `?${qs}` : "";
}
