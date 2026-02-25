// backend/src/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { prisma } from "./prisma.js";

import { enrichUser, upsertPermission, upsertRole } from "./rbac.js";

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

// Counters
import peopleCountersRouter from "./routes/peopleCounters.js";

const app = express();

app.set("trust proxy", true);

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

if (process.env.NODE_ENV !== "production") {
  // 🔎 DEBUG local: voir si le Bearer arrive
  app.use((req, _res, next) => {
    if (
      req.path.startsWith("/operations") ||
      req.path.startsWith("/activity") ||
      req.path.startsWith("/people/counters") ||
      req.path.startsWith("/people") ||
      req.path.startsWith("/resources") ||
      req.path.startsWith("/documents") ||
      req.path.startsWith("/employees")
    ) {
      const a = req.headers.authorization;
      console.log(
        "[AUTH DEBUG]",
        req.method,
        req.path,
        "authHeader?",
        !!a,
        a ? a.slice(0, 30) + "..." : ""
      );
    }
    next();
  });
}

app.use(
  "/uploads",
  express.static(path.resolve("uploads"), {
    fallthrough: false,
    etag: true,
    maxAge: "1h",
  })
);

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

/* =========================
 *         ROUTERS
 * ========================= */

// ✅ Middleware commun pour toutes les routes privées
const kc = [verifyKeycloak, attachDbAuthFromKeycloak];

// PROTÉGÉES Keycloak + DB mapping + RBAC (dans les routers via requirePermissions)
app.use("/resources/compliance", ...kc, complianceRouter);
app.use("/resources/policies", ...kc, policiesRouter);

app.use("/people", ...kc, peopleRouter);
app.use("/people/counters", ...kc, peopleCountersRouter);

app.use("/employees", ...kc, employeesRouter);
app.use("/performance", ...kc, performanceRouter);
app.use("/training", ...kc, trainingRouter);
app.use("/documents", ...kc, documentsRouter);

app.use("/operations/events", ...kc, eventsRouter);
app.use("/operations/expenses", ...kc, expensesRouter);
app.use("/operations/leaves", ...kc, leavesRouter);
app.use("/operations/timesheets", ...kc, timesheetsRouter);

app.use("/activity", ...kc, activityRouter);

// PUBLIQUES
app.use("/dashboard", dashboardRouter);

/* =========================
 *         START
 * ========================= */
const port = process.env.PORT || 4000;
app.listen(port, () => console.log("API running on http://localhost:" + port));
