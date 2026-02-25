const KEY = "sirh_form_kpis_v1";

const DEFAULT_MODULE_METRICS = {
  attempts: 0,
  errors: 0,
  success: 0,
  totalDurationMs: 0,
  completionRatios: [],
  docsEvidence: { uploaded: 0, due: 0 },
};

function cloneDefaults() {
  return {
    ...DEFAULT_MODULE_METRICS,
    completionRatios: [],
    docsEvidence: { ...DEFAULT_MODULE_METRICS.docsEvidence },
  };
}

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch (_e) {
    return {};
  }
}

function writeStore(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch (_e) {
    // ignore storage errors (private mode/quota)
  }
}

function ensureModule(data, module) {
  if (!data[module]) data[module] = cloneDefaults();
  return data[module];
}

export function kpiStart(module) {
  const data = readStore();
  const m = ensureModule(data, module);
  m.attempts += 1;
  writeStore(data);
  return Date.now();
}

export function kpiSuccess(module, startedAt, completionRatio = 1) {
  const data = readStore();
  const m = ensureModule(data, module);
  m.success += 1;
  m.totalDurationMs += Math.max(0, Date.now() - (startedAt || Date.now()));
  m.completionRatios.push(Math.max(0, Math.min(1, completionRatio)));
  writeStore(data);
}

export function kpiError(module) {
  const data = readStore();
  const m = ensureModule(data, module);
  m.errors += 1;
  writeStore(data);
}

export function kpiComplianceEvidence(uploadedDelta = 0, dueDelta = 0) {
  const data = readStore();
  const m = ensureModule(data, "compliance");
  m.docsEvidence.uploaded += uploadedDelta;
  m.docsEvidence.due += dueDelta;
  writeStore(data);
}

export function getKpiSnapshot() {
  return readStore();
}
