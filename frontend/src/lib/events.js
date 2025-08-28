// src/lib/events.js

/**
 * Emet un CustomEvent au niveau window.
 * On force detail = {} par défaut pour éviter les erreurs
 * quand des listeners font e.detail.xxx.
 */
export const emit = (name, detail = {}) =>
  window.dispatchEvent(new CustomEvent(name, { detail }));

/* -------------------------
 *  Opérations (planning, etc.)
 * ------------------------- */

/**
 * Planification / événements (planning) modifiés
 * @param {object} detail - ex: { action: 'create' | 'update' | 'delete', id, ... }
 */
export const emitEventsChanged = (detail = {}) => emit('events:changed', detail);

/* -------------------------
 *  People (RH)
 * ------------------------- */

/**
 * Employés modifiés (création, mise à jour, suppression…)
 * @param {object} detail - ex: { action: 'create', id }
 */
export const emitEmployeesChanged = (detail = {}) => emit('employees:changed', detail);

/**
 * Objectifs / Performance modifiés
 * @param {object} detail - ex: { action: 'update', goalId }
 */
export const emitGoalsChanged = (detail = {}) => emit('goals:changed', detail);

/**
 * Formation / Training modifiés
 * Option B : tu peux envoyer { sessionsSoon14: number } pour synchroniser le badge de la sidebar.
 * @param {object} detail - ex: { sessionsSoon14: 2, certsExpiring: 1, source: 'formation_page' }
 */
export const emitTrainingChanged = (detail = {}) => emit('training:changed', detail);

/* -------------------------
 *  Global
 * ------------------------- */

/**
 * Demande générique de rafraîchissement des compteurs
 * (la sidebar et/ou le dashboard écoutent 'app:counters:refresh').
 */
export const emitRefreshCounters = () => emit('app:counters:refresh', {});
