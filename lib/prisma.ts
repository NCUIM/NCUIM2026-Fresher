import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 起，執行期連線由 driver adapter 建立，不再從 schema 讀取 url。
// Migrate 的連線字串則由 prisma.config.ts 提供。
/*
  連線池上限。

  這個數字要跟部署方式一起看，因為它是「每個執行個體」的上限：

    執行個體數 × 這個值  ≤  資料庫的 max_connections（再留點餘裕）

  Cloud SQL 這類自己開的資料庫要自己算這道算術（例如 Cloud Run 設
  --max-instances=4，這裡設 5，最多就是 20 條）。Neon、Supabase 前面有
  自己的連線池，壓力小得多，但仍不該讓單一執行個體無限制地開。

  預設 5 而不是 pg 的預設 10：這個 app 的查詢都很短，5 條足夠讓
  七十人的活動不排隊，同時把撞上資料庫上限的風險壓到最低。
*/
const POOL_MAX = Number(process.env.DB_POOL_MAX ?? 5);

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 未設定，請參考 .env.example 建立 .env");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: POOL_MAX }),
  });
}

// 開發模式下 Next.js 的熱重載會重複建立模組，若不快取會耗盡連線數。
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
