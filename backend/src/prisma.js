// backend/src/prisma.js
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"], // optionnel, pratique en dev
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
