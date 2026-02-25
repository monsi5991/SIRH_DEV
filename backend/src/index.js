// backend/src/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import path from "path";
import { prisma } from "./prisma.js";

import {
  verifyPassword,
  signAccess,
  issueRefresh,
  rotateRefreshAndMintAccess,
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE,
} from "./auth.js";

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

// 🔎 DEBUG: voir si le Bearer arrive (à enlever en prod)
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
 *     AUTH (legacy DB)
 *  (tu peux garder pour créer l'user DB,
 *   mais la navigation app passe par Keycloak)
 * ========================= */

app.post("/auth/register", async (req, res) => {
  try {
    const { companyName, country, city, industry, size, email, password, firstName, lastName } = req.body || {};
    if (!companyName || !email || !password) return res.status(400).json({ error: "Missing required fields" });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "Email already registered" });

    const tenant = await prisma.tenant.create({
      data: {
        name: companyName,
        country: country || null,
        city: city || null,
        industry: industry || null,
        size: size || null,
      },
    });

    const entity = await prisma.entity.create({ data: { name: "HQ", tenantId: tenant.id } });

    const roleAdmin = await upsertRole(prisma, "Admin", tenant.id);
    const roleRH = await upsertRole(prisma, "RH", tenant.id);
    const roleManager = await upsertRole(prisma, "Manager", tenant.id);
    const roleEmployee = await upsertRole(prisma, "Employee", tenant.id);

    const permNames = ["all", "operations_read", "operations_write", "directory_read"];
    const permsByName = {};
    for (const p of permNames) permsByName[p] = await upsertPermission(prisma, p, tenant.id);

    await prisma.rolePermission.deleteMany({
      where: { roleId: { in: [roleAdmin.id, roleRH.id, roleManager.id, roleEmployee.id] } },
    });

    await prisma.rolePermission.createMany({
      data: [
        ...Object.values(permsByName).map((p) => ({ roleId: roleAdmin.id, permissionId: p.id })),
        ...Object.values(permsByName).map((p) => ({ roleId: roleRH.id, permissionId: p.id })),
      ],
      skipDuplicates: true,
    });

    await prisma.rolePermission.createMany({
      data: [
        { roleId: roleManager.id, permissionId: permsByName["operations_read"].id },
        { roleId: roleManager.id, permissionId: permsByName["operations_write"].id },
        { roleId: roleManager.id, permissionId: permsByName["directory_read"].id },
      ],
      skipDuplicates: true,
    });

    await prisma.rolePermission.createMany({
      data: [{ roleId: roleEmployee.id, permissionId: permsByName["directory_read"].id }],
      skipDuplicates: true,
    });

    const names = firstName && lastName ? { firstName, lastName } : deriveNamesFromEmail(email);
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: names.firstName,
        lastName: names.lastName,
        tenantId: tenant.id,
        entityId: entity.id,
      },
    });

    await prisma.userRole.create({ data: { userId: user.id, roleId: roleAdmin.id } });

    await prisma.employee.upsert({
      where: { email: user.email },
      update: {
        userId: user.id,
        tenantId: user.tenantId,
        firstName: user.firstName,
        lastName: user.lastName,
        status: "ACTIVE",
      },
      create: {
        tenantId: user.tenantId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        status: "ACTIVE",
        contractType: "CDI",
        country: "SN",
        site: "Dakar",
        joinDate: new Date(),
        userId: user.id,
      },
    });

    // legacy tokens (optionnel)
    const accessToken = signAccess(user);
    const refresh = await issueRefresh(user.id);
    setRefreshCookie(res, refresh);

    const me = await enrichUser(user.id);
    return res.json({ user: me, accessToken });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const accessToken = signAccess(user);
  const refresh = await issueRefresh(user.id);
  setRefreshCookie(res, refresh);

  const me = await enrichUser(user.id);
  return res.json({ user: me, accessToken });
});

app.post("/auth/refresh", async (req, res) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    const minted = await rotateRefreshAndMintAccess(raw);
    if (!minted) return res.status(401).json({ error: "Invalid refresh" });

    setRefreshCookie(res, minted.refresh);
    return res.json({ ok: true, accessToken: minted.accessToken });
  } catch (e) {
    console.error(e);
    return res.status(401).json({ error: "Invalid refresh" });
  }
});

app.post("/auth/logout", async (_req, res) => {
  clearRefreshCookie(res);
  return res.json({ ok: true });
});

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
        error: "User not found in DB for this Keycloak account. Create it via /auth/register then create same email in Keycloak.",
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
