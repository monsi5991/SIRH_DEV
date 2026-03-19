// backend/src/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import { enrichUser } from "./rbac.js";

// ✅ Keycloak verifier
import { verifyKeycloak } from "./verifyKeycloak.js";

// ✅ DB mapping middleware (Keycloak -> user DB -> req.auth)
import { attachDbAuthFromKeycloak } from "./middlewares/attachDbAuthFromKeycloak.js";

// Routers modulaires
import dashboardRouter from "./routes/dashboard.js";
import eventsRouter from "./routes/operations/events.js";
import expensesRouter from "./routes/operations/expenses.js";
import leavesRouter from "./routes/operations/leaves.js";
import timesheetsRouter from "./routes/operations/timesheets.js";
import activityRouter from "./routes/activity.js";
import adminRouter from "./routes/admin.js";
import workflowsRouter from "./routes/workflows.js";
import hrRequestsRouter from "./routes/hrRequests.js";
import interviewsRouter from "./routes/interviews.js";
import notificationsRouter from "./routes/notifications.js";
import connectorsRouter from "./routes/connectors.js";
import analyticsRouter from "./routes/analytics.js";
import secureUploadsRouter from "./routes/secureUploads.js";
import syncRouter from "./routes/sync.js";

// RH/People
import peopleRouter from "./routes/people.js";
import employeesRouter from "./routes/people/employees.js";
import performanceRouter from "./routes/performance.js";
import trainingRouter from "./routes/training.js";

// Documents
import documentsRouter from "./routes/documents.js";

// Resources
import complianceRouter from "./routes/resources/compliance.js";
import policiesRouter from "./routes/resources/policies.js";
import meRouter from "./routes/me.js";

const app = express();

app.set("trust proxy", true);

const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Autorise curl, healthchecks et calls serveur-à-serveur sans Origin.
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

const rateWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 1200);
const rateBuckets = new Map();
app.use((req, res, next) => {
  const now = Date.now();
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const key = Array.isArray(ip) ? ip[0] : String(ip);
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart > rateWindowMs) {
    rateBuckets.set(key, { windowStart: now, count: 1 });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > rateLimitMax) {
    return res.status(429).json({ error: "Too many requests" });
  }
  return next();
});

app.use(express.json());
app.use(cookieParser());

if (process.env.AUTH_DEBUG === "true") {
  // 🔎 DEBUG local: voir si le Bearer arrive
  app.use((req, _res, next) => {
    if (
      req.path.startsWith("/operations") ||
      req.path.startsWith("/activity") ||
      req.path.startsWith("/people/counters") ||
      req.path.startsWith("/people") ||
      req.path.startsWith("/resources") ||
      req.path.startsWith("/documents") ||
      req.path.startsWith("/employees") ||
      req.path.startsWith("/admin") ||
      req.path.startsWith("/workflows") ||
      req.path.startsWith("/requests") ||
      req.path.startsWith("/interviews") ||
      req.path.startsWith("/notifications") ||
      req.path.startsWith("/connectors") ||
      req.path.startsWith("/analytics")
    ) {
      const a = req.headers.authorization;
      console.log(
        "[AUTH DEBUG]",
        req.method,
        req.path,
        "authHeader?",
        !!a
      );
    }
    next();
  });
}

// ✅ Middleware commun pour toutes les routes privées
const kc = [verifyKeycloak, attachDbAuthFromKeycloak];

const uploadsPublic =
  process.env.UPLOADS_PUBLIC === "true" && process.env.NODE_ENV !== "production";
if (uploadsPublic) {
  app.use(
    "/uploads",
    express.static(path.resolve("uploads"), {
      fallthrough: false,
      etag: true,
      maxAge: "1h",
    })
  );
} else {
  app.use("/uploads", ...kc, secureUploadsRouter);
}

// Healthcheck
app.get("/", (_req, res) => res.json({ ok: true }));

function deriveNamesFromEmail(email = "") {
  const local = (email.split("@")[0] || "").replace(/[._-]+/g, " ").trim();
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "");
  if (!local) return { firstName: "Admin", lastName: "User" };
  const parts = local.split(" ").filter(Boolean);
  if (parts.length === 1) return { firstName: cap(parts[0]), lastName: "Admin" };
  return { firstName: cap(parts[0]), lastName: cap(parts.slice(1).join(" ")) };
}

/* =========================
 *          ME (Keycloak)
 * =========================
 * ✅ on fait verifyKeycloak + attachDbAuthFromKeycloak
 * => req.auth = { sub: userId, tid: tenantId }
 * => req.kc contient les infos token
 */
app.get("/me", verifyKeycloak, attachDbAuthFromKeycloak, async (req, res) => {
  try {
    // attachDbAuthFromKeycloak doit aussi mettre req.user (db user)
    const dbUser = req.user;
    if (!dbUser) {
      return res.status(404).json({
        error: "User not found in DB for this Keycloak account. Provision this user in SIRH DB with the same email as Keycloak.",
      });
    }

    const me = await enrichUser(dbUser.id);
    return res.json({ user: me });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to load user" });
  }
});
app.use("/me", ...kc, meRouter);

/* =========================
 *         ROUTERS
 * ========================= */

// PROTÉGÉES Keycloak + DB mapping + RBAC (dans les routers via requirePermissions)
app.use("/resources/compliance", ...kc, complianceRouter);
app.use("/resources/policies", ...kc, policiesRouter);

app.use("/people", ...kc, peopleRouter);

app.use("/employees", ...kc, employeesRouter);
app.use("/performance", ...kc, performanceRouter);
app.use("/training", ...kc, trainingRouter);
app.use("/documents", ...kc, documentsRouter);

app.use("/operations/events", ...kc, eventsRouter);
app.use("/operations/expenses", ...kc, expensesRouter);
app.use("/operations/leaves", ...kc, leavesRouter);
app.use("/operations/timesheets", ...kc, timesheetsRouter);

app.use("/activity", ...kc, activityRouter);
app.use("/admin", ...kc, adminRouter);
app.use("/workflows", ...kc, workflowsRouter);
app.use("/requests/hr", ...kc, hrRequestsRouter);
app.use("/interviews", ...kc, interviewsRouter);
app.use("/notifications", ...kc, notificationsRouter);
app.use("/connectors", ...kc, connectorsRouter);
app.use("/analytics", ...kc, analyticsRouter);
app.use("/sync", ...kc, syncRouter);

// Dashboard (protégé, comme le reste des métriques internes)
app.use("/dashboard", ...kc, dashboardRouter);

/* =========================
 *         START
 * ========================= */
const port = process.env.PORT || 4000;
app.listen(port, () => console.log("API running on http://localhost:" + port));
