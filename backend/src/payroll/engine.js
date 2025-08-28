import Decimal from "decimal.js";

const D = (x = 0) => new Decimal(x);
const toInt = (d) => d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
function floorTo(d, unit = 1) {
  if (!unit || unit <= 1) return d.toDecimalPlaces(0, Decimal.ROUND_FLOOR);
  const u = new Decimal(unit);
  return d.div(u).floor().times(u);
}
export function applyScale(amount, scale) {
  let a = new Decimal(amount);
  for (const br of scale) {
    if (br.upTo == null) return a.times(br.rate);
    if (a.lte(br.upTo)) return a.times(br.rate);
  }
  return a.times(scale[scale.length - 1].rate);
}
export function lookupTrimf(base, table) {
  const a = new Decimal(base);
  for (const r of table) {
    const minOk = a.gte(r.min);
    const maxOk = (r.max == null) ? true : a.lte(r.max);
    if (minOk && maxOk) return new Decimal(r.amount || 0);
  }
  return D(0);
}

/**
 * computePayrollSN
 * @param {object} input - variables de paie du salarié
 * @param {object} cfg   - règles Sénégal (senegal_2025.json)
 */
export function computePayrollSN(input, cfg) {
  const {
    base = 0,
    primesTaxables = [],   // [{label, amount}]
    primesNonTax = [],     // [{label, amount}]
    avantages = [],        // [{label, amount}] (imposables IR/TRIMF)
    overtime = [],         // [{label, hours, hourly, premium}]
    absencesOuvres = 0,
    joursOuvresMois = 26,
    retenues = [],         // [{label, amount}]
    remboursements = [],   // [{label, amount}] post-net
    cadre = false,
    atRate = 0.03          // 0.01/0.03/0.05
  } = input;

  const primesT = D(primesTaxables.reduce((s, p) => s + (p.amount || 0), 0));
  const primesNT = D(primesNonTax.reduce((s, p) => s + (p.amount || 0), 0));
  const avn = D(avantages.reduce((s, a) => s + (a.amount || 0), 0));
  const hs = D(overtime.reduce((s, o) => s + (o.hours || 0) * (o.hourly || 0) * (1 + (o.premium || 0)), 0));
  const retenueAbs = toInt(D(base).div(joursOuvresMois).times(absencesOuvres));

  const brut = toInt(D(base).plus(primesT).plus(hs).minus(retenueAbs));

  // Cotisations
  const ipresAss = Decimal.min(brut, D(cfg.ceilings.IPRES_GENERAL));
  const ipresEmp = toInt(ipresAss.times(cfg.contribs.IPRES_GENERAL.employer));
  const ipresSal = toInt(ipresAss.times(cfg.contribs.IPRES_GENERAL.employee));

  const cadreAss = cadre ? Decimal.min(brut, D(cfg.ceilings.IPRES_CADRE)) : D(0);
  const ipresCadEmp = cadre ? toInt(cadreAss.times(cfg.contribs.IPRES_CADRE.employer)) : D(0);
  const ipresCadSal = cadre ? toInt(cadreAss.times(cfg.contribs.IPRES_CADRE.employee)) : D(0);

  const cssBase = Decimal.min(brut, D(cfg.ceilings.CSS_PF));
  const cssPfEmp = toInt(cssBase.times(cfg.contribs.CSS_PF.employer));
  const cssAtEmp = toInt(cssBase.times(atRate || 0)); // 1/3/5 %

  // IR & TRIMF
  const irBaseGross = D(brut).plus(avn);
  const abat = Decimal.min(irBaseGross.times(cfg.ir.abatement.rate), D(cfg.ir.abatement.cap));
  const irBase = Decimal.max(D(0), irBaseGross.minus(abat));
  const irRaw = applyScale(irBase, cfg.ir.scaleMonthly);
  const ir = floorTo(irRaw, cfg.ir.rounding.unit);
  const trimf = lookupTrimf(irBaseGross, cfg.trimfMonthly);

  // Net
  const retSal = D(retenues.reduce((s, r) => s + (r.amount || 0), 0));
  const cotSal = ipresSal.plus(ipresCadSal);
  const impots = Decimal.max(ir, trimf);
  const netAvantRbt = D(brut).minus(cotSal).minus(impots).minus(retSal);
  const rbt = D(remboursements.reduce((s, r) => s + (r.amount || 0), 0));
  const netAPayer = toInt(netAvantRbt.plus(rbt));

  // Coût employeur
  const cotEmp = ipresEmp.plus(ipresCadEmp).plus(cssPfEmp).plus(cssAtEmp);
  const cfce = toInt(D(cfg.taxes.CFCE || 0).times(brut));
  const coutEmployeur = toInt(D(brut).plus(cotEmp).plus(cfce));

  const lines = [];
  const push = (kind, label, amt) => lines.push({ kind, label, amount: toInt(D(amt)).toNumber() });

  push("EARNING", "Salaire de base", base);
  primesTaxables.forEach(p => push("EARNING", p.label, p.amount));
  if (hs.gt(0)) push("EARNING", "Heures supplémentaires", hs);
  if (primesNT.gt(0)) push("EARNING", "Primes non imposables", primesNT);
  if (avn.gt(0)) push("EARNING", "Avantages en nature", avn);

  if (retenueAbs.gt(0)) push("DEDUCTION", "Retenue absence", -retenueAbs);

  if (ipresSal.gt(0)) push("EMPLOYEE_CONTRIB", "IPRES (salarié)", -ipresSal);
  if (ipresCadSal.gt(0)) push("EMPLOYEE_CONTRIB", "IPRES Cadre (salarié)", -ipresCadSal);
  if (ir.gt(0)) push("TAX", "IR", -ir);
  if (trimf.gt(0)) push("TAX", "TRIMF", -trimf);
  retenues.forEach(r => push("DEDUCTION", r.label, -(r.amount || 0)));

  if (rbt.gt(0)) push("REIMBURSEMENT", "Remboursements", rbt);

  if (ipresEmp.gt(0)) push("EMPLOYER_CONTRIB", "IPRES (employeur)", ipresEmp);
  if (ipresCadEmp.gt(0)) push("EMPLOYER_CONTRIB", "IPRES Cadre (employeur)", ipresCadEmp);
  if (cssPfEmp.gt(0)) push("EMPLOYER_CONTRIB", "CSS Prest. familiales", cssPfEmp);
  if (cssAtEmp.gt(0)) push("EMPLOYER_CONTRIB", "CSS AT", cssAtEmp);
  if (cfce.gt(0)) push("EMPLOYER_TAX", "CFCE 3%", cfce);

  return {
    currency: cfg.currency || "XOF",
    brut: brut.toNumber(),
    net: netAPayer.toNumber(),
    ipres_sal: ipresSal.toNumber(),
    ipres_emp: ipresEmp.toNumber(),
    ipres_cadre_sal: ipresCadSal.toNumber(),
    ipres_cadre_emp: ipresCadEmp.toNumber(),
    css_pf_emp: cssPfEmp.toNumber(),
    css_at_emp: cssAtEmp.toNumber(),
    ir: ir.toNumber(),
    trimf: trimf.toNumber(),
    cfce: cfce.toNumber(),
    coutEmployeur: coutEmployeur.toNumber(),
    lines
  };
}
