import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 起，執行期連線由 driver adapter 建立，不再從 schema 讀取 url。
// Migrate 的連線字串則由 prisma.config.ts 提供。
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 未設定，請參考 .env.example 建立 .env");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// 開發模式下 Next.js 的熱重載會重複建立模組，若不快取會耗盡連線數。
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
