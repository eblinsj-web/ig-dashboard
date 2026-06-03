// Neon Postgres 기반 저장소.
// 기존엔 data/날짜.json 파일에 저장했지만, 클라우드(Render 무료)에선
// 파일이 날아가므로 DB에 저장한다. 구조는 파일 때와 동일하게:
// "그 날짜의 수집 결과 전체(JSON)"를 날짜를 키로 한 행에 저장.

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
dotenv.config();

const { DATABASE_URL } = process.env;

let sql = null;
if (DATABASE_URL) {
  sql = neon(DATABASE_URL);
} else {
  console.warn("[db] DATABASE_URL 이 설정되지 않음 — DB 기능 비활성");
}

// 테이블 준비 (없으면 생성). 서버 시작 시 한 번 호출.
export async function initDb() {
  if (!sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS snapshots (
      date TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      collected_at TIMESTAMPTZ DEFAULT now()
    )
  `;
}

// 하루치 스냅샷 저장 (같은 날짜면 덮어쓰기)
export async function saveSnapshot(date, payload) {
  if (!sql) throw new Error("DATABASE_URL 미설정");
  await sql`
    INSERT INTO snapshots (date, payload, collected_at)
    VALUES (${date}, ${JSON.stringify(payload)}, now())
    ON CONFLICT (date) DO UPDATE
      SET payload = EXCLUDED.payload, collected_at = now()
  `;
}

// 모든 스냅샷을 { "YYYY-MM-DD": payload } 형태로 반환 (날짜 오름차순)
export async function getAllSnapshots() {
  if (!sql) return {};
  const rows = await sql`SELECT date, payload FROM snapshots ORDER BY date ASC`;
  const byDate = {};
  for (const r of rows) {
    byDate[r.date] = typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload;
  }
  return byDate;
}

export const dbReady = !!sql;
