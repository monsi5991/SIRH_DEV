const KEY = "sirh_form_kpis_v1";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch (e) {
    // fallback: storage indisponible ou JSON invalide
    void e;
    return {};
  }
}
function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); }
  catch (e) {
    // fallback: quota/private mode
    void e;
  }
}

export function kpiStart(module) {
  const data = read();
  data[module] = data[module] || { attempts: 0, errors: 0, success: 0, totalDurationMs: 0, completionRatios: [], docsEvidence: { uploaded: 0, due: 0 } };
  data[module].attempts += 1;
  write(data);
  return Date.now();
}

export function kpiSuccess(module, startedAt, completionRatio = 1) {
  const data = read();
  data[module] = data[module] || { attempts: 0, errors: 0, success: 0, totalDurationMs: 0, completionRatios: [], docsEvidence: { uploaded: 0, due: 0 } };
  data[module].success += 1;
  data[module].totalDurationMs += Math.max(0, Date.now() - (startedAt || Date.now()));
  data[module].completionRatios.push(Math.max(0, Math.min(1, completionRatio)));
  write(data);
}

export function kpiError(module) {
  const data = read();
  data[module] = data[module] || { attempts: 0, errors: 0, success: 0, totalDurationMs: 0, completionRatios: [], docsEvidence: { uploaded: 0, due: 0 } };
  data[module].errors += 1;
  write(data);
}

export function kpiComplianceEvidence(uploadedDelta = 0, dueDelta = 0) {
  const module = "compliance";
  const data = read();
  data[module] = data[module] || { attempts: 0, errors: 0, success: 0, totalDurationMs: 0, completionRatios: [], docsEvidence: { uploaded: 0, due: 0 } };
  data[module].docsEvidence.uploaded += uploadedDelta;
  data[module].docsEvidence.due += dueDelta;
  write(data);
}

export function getKpiSnapshot() { return read(); }
