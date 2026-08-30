import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * 讓 node 解析得到 `lib/` 裡沒有寫副檔名的相對匯入。
 *
 * `lib/` 全部寫成 `import { prisma } from "./prisma"`——那是 Next 與
 * TypeScript 的慣例，打包器會自己補上副檔名。但 node 的 ESM 解析器不會：
 * 規格要求相對匯入是完整的檔案路徑。於是任何直接用 node 執行、又匯入
 * 了 lib 模組的腳本都會在載入階段就死掉。
 *
 * 三條路可走，這是代價最小的一條：
 *   - 把二十幾個 lib 檔的匯入都補上 `.ts`：得開 allowImportingTsExtensions，
 *     而且與整個專案其餘部分的寫法不一致。
 *   - 讓腳本不要匯入 lib：那就得複製一份寄信邏輯，測到的也不再是正式程式碼。
 *   - 在腳本這一側補上解析規則：lib 一個字都不用改，而正式執行路徑
 *     （Next 打包）根本不會經過這裡。
 *
 * 用法：node --import ./scripts/resolve-ts.mjs scripts/你的腳本.mts
 */
/*
  只補 TypeScript 的副檔名，而且只在專案自己的原始碼裡補。

  這個掛鉤同時會攔到 CommonJS 的 require——node_modules 裡的套件到處都是
  `require("./lib/main")` 這種寫法，若一併接手，回傳的 file:// URL 會讓 CJS
  解析器直接爆掉（它要的是路徑不是 URL）。把範圍收在 .ts 上，那些 .js 的
  相對匯入就會原封不動交還給預設解析器。
*/
const EXTENSIONS = [".ts", ".tsx", ".mts"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    // 只處理沒有副檔名的相對路徑，其餘一律交還給預設解析器。
    if (specifier.startsWith(".") && path.extname(specifier) === "") {
      const parent = context.parentURL
        ? path.dirname(fileURLToPath(context.parentURL))
        : process.cwd();
      if (parent.includes("node_modules")) {
        return nextResolve(specifier, context);
      }
      const base = path.resolve(parent, specifier);
      for (const ext of EXTENSIONS) {
        if (existsSync(base + ext)) {
          return nextResolve(pathToFileURL(base + ext).href, context);
        }
      }
      // 目錄形式的匯入（./foo → ./foo/index.ts）
      for (const ext of EXTENSIONS) {
        const indexFile = path.join(base, `index${ext}`);
        if (existsSync(indexFile)) {
          return nextResolve(pathToFileURL(indexFile).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
