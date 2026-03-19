import express from "express";
import { requirePermissions } from "../rbac.js";
import {
  buildDashboardInsights,
  connectorsCatalog,
  fetchCountryProfile,
  fetchFxRates,
  fetchMacroPack,
  fetchPublicHolidays,
  fetchWeatherForecast,
  paymentConnectorStatus,
} from "../lib/externalConnectors.js";

const router = express.Router();

const CAN_USE_CONNECTORS = ["self_read", "team_read", "directory_read", "analytics_read", "admin_read", "all"];

function listFromQuery(v, fallback = []) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (v == null || v === "") return fallback;
  return String(v)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

router.get(
  "/catalog",
  requirePermissions(CAN_USE_CONNECTORS, "anyOf"),
  async (_req, res) => {
    return res.json({
      generatedAt: new Date().toISOString(),
      items: connectorsCatalog(),
      payments: paymentConnectorStatus(),
    });
  }
);

router.get(
  "/country-profile",
  requirePermissions(CAN_USE_CONNECTORS, "anyOf"),
  async (req, res) => {
    try {
      const countryCode = String(req.query.country || "SN");
      const data = await fetchCountryProfile({ countryCode });
      return res.json(data);
    } catch (e) {
      console.error("[connectors/country-profile] error:", e);
      return res.status(500).json({ error: "connectors_country_profile_failed" });
    }
  }
);

router.get(
  "/holidays",
  requirePermissions(CAN_USE_CONNECTORS, "anyOf"),
  async (req, res) => {
    try {
      const countryCode = String(req.query.country || "SN");
      const year = Number(req.query.year) || new Date().getUTCFullYear();
      const data = await fetchPublicHolidays({ countryCode, year });
      return res.json(data);
    } catch (e) {
      console.error("[connectors/holidays] error:", e);
      return res.status(500).json({ error: "connectors_holidays_failed" });
    }
  }
);

router.get(
  "/fx",
  requirePermissions(CAN_USE_CONNECTORS, "anyOf"),
  async (req, res) => {
    try {
      const base = String(req.query.base || "XOF");
      const symbols = listFromQuery(req.query.symbols, ["EUR", "USD", "NGN", "GHS"]);
      const data = await fetchFxRates({ base, symbols });
      return res.json(data);
    } catch (e) {
      console.error("[connectors/fx] error:", e);
      return res.status(500).json({ error: "connectors_fx_failed" });
    }
  }
);

router.get(
  "/weather",
  requirePermissions(CAN_USE_CONNECTORS, "anyOf"),
  async (req, res) => {
    try {
      const countryCode = String(req.query.country || "SN");
      const city = String(req.query.city || "Dakar");
      const lang = String(req.query.lang || "fr");
      const data = await fetchWeatherForecast({ city, countryCode, lang });
      return res.json(data);
    } catch (e) {
      console.error("[connectors/weather] error:", e);
      return res.status(500).json({ error: "connectors_weather_failed" });
    }
  }
);

router.get(
  "/macro",
  requirePermissions(CAN_USE_CONNECTORS, "anyOf"),
  async (req, res) => {
    try {
      const countryCode = String(req.query.country || "SN");
      const data = await fetchMacroPack({ countryCode });
      return res.json(data);
    } catch (e) {
      console.error("[connectors/macro] error:", e);
      return res.status(500).json({ error: "connectors_macro_failed" });
    }
  }
);

router.get(
  "/insights/dashboard",
  requirePermissions(CAN_USE_CONNECTORS, "anyOf"),
  async (req, res) => {
    try {
      const countryCode = String(req.query.country || "SN");
      const city = String(req.query.city || "Dakar");
      const year = Number(req.query.year) || new Date().getUTCFullYear();
      const lang = String(req.query.lang || "fr");
      const data = await buildDashboardInsights({ countryCode, city, year, lang });
      return res.json(data);
    } catch (e) {
      console.error("[connectors/insights/dashboard] error:", e);
      return res.status(500).json({ error: "connectors_dashboard_insights_failed" });
    }
  }
);

router.get(
  "/payments/providers",
  requirePermissions(CAN_USE_CONNECTORS, "anyOf"),
  async (_req, res) => {
    return res.json(paymentConnectorStatus());
  }
);

export default router;
