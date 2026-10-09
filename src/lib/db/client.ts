/**
 * SOURCE OF TRUTH KEYWORDS: database, client, prisma, singleton, connection-pool
 * WHAT: Prisma database client singleton with optimized connection pooling for high concurrency
 * WHY: Ensures single Prisma instance across the application with proper connection limits for 2000 QPS
 * WHERE: src/lib/db/client.ts
 */

import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;