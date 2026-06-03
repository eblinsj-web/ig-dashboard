import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { collectInstagram } from "./collectors.js";
import { startScheduler, runCollection } from "./scheduler.js";
import { getFollowerTrend, getMonthlyRollup } from "./aggregate.js";
import { initDb } from "./db.js";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const { ACCESS_TOKEN, IG_ACCOUNT_ID, PORT = 3000, RUN_ON_START } = process.env;

if (!ACCESS_TOKEN || !IG_ACCOUNT_ID) {
  console.error(
    "\n[ERROR] ACCESS_TOKEN and IG_ACCOUNT_ID must be set in .env\n" +
      "        Copy .env.example to .env and fill in your values.\n"
  );
  process.exit(1);
}

app.use(express.static(join(__dirname, "public")));

// 메인: 최근 100개를 수집해 월별 집계 + 최근 20개 카드 + 7일 추이를 한번에 반환
app.get("/api/dashboard", async (req, res) => {
  try {
    const { posts } = await collectInstagram(100);

    // 최신순 정렬
    const sorted = [...posts].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    const monthly = getMonthlyRollup(sorted, 2026);
    const recent = sorted.slice(0, 20);
    const followerTrend = await getFollowerTrend();

    // 이번 달(서버 기준 현재 연-월, KST) 게시물 중 BEST
    const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const ym = `${nowKST.getUTCFullYear()}-${String(nowKST.getUTCMonth() + 1).padStart(2, "0")}`;
    const thisMonth = sorted.filter((p) => (p.timestamp || "").slice(0, 7) === ym);
    const bestReach = thisMonth.length
      ? thisMonth.reduce((a, b) => ((b.metrics?.reach ?? 0) > (a.metrics?.reach ?? 0) ? b : a))
      : null;
    const bestEngagement = thisMonth.length
      ? thisMonth.reduce((a, b) => ((b.engagement ?? 0) > (a.engagement ?? 0) ? b : a))
      : null;
    const best = { month: ym, reach: bestReach, engagement: bestEngagement };

    res.json({ monthly, recent, followerTrend, best });
  } catch (err) {
    console.error("[/api/dashboard]", err.message);
    res.status(502).json({ error: err.message, code: err.code ?? null });
  }
});

// (이전 호환) 단순 게시물 목록
app.get("/api/posts", async (req, res) => {
  try {
    const data = await collectInstagram(25);
    res.json(data);
  } catch (err) {
    console.error("[/api/posts]", err.message);
    res.status(502).json({ error: err.message, code: err.code ?? null });
  }
});

app.listen(PORT, async () => {
  console.log(`\n  IG dashboard running → http://localhost:${PORT}\n`);
  try {
    await initDb();
    console.log("🗄️  DB 준비 완료 (snapshots 테이블)");
  } catch (e) {
    console.log("⚠️  DB 초기화 실패 —", e.message);
  }
  startScheduler();
  if (RUN_ON_START === "1") {
    runCollection().catch((e) => console.error("초기 수집 오류:", e));
  }
});
