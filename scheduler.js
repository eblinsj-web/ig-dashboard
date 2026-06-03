// 매일 자정 0시(한국 시간) 자동 수집 스케줄러.
// - Promise.allSettled: 한 채널이 실패해도 나머지는 계속 진행
// - 성공/실패를 콘솔에 로그
// - 결과는 Neon DB(snapshots 테이블)에 저장

import cron from "node-cron";
import { CHANNELS } from "./collectors.js";
import { saveSnapshot } from "./db.js";

// 한국 날짜 문자열 (YYYY-MM-DD). offsetDays=-1 이면 전날.
function kstDateString(offsetDays = 0, base = new Date()) {
  const d = new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function ts() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date());
}

// 한 번의 수집 실행. server.js에서도 즉시 실행용으로 재사용합니다.
export async function runCollection() {
  const active = CHANNELS.filter((c) => c.enabled);
  console.log(`\n[${ts()}] 수집 시작 — 대상 채널: ${active.map((c) => c.name).join(", ")}`);

  const results = await Promise.allSettled(active.map((c) => c.collect()));

  const collected = {};
  let ok = 0;
  let fail = 0;

  results.forEach((r, i) => {
    const name = active[i].name;
    if (r.status === "fulfilled") {
      ok++;
      collected[name] = r.value;
      const count = r.value?.posts?.length ?? "?";
      console.log(`  ✅ [${name}] 수집 성공 (항목 ${count}개)`);
    } else {
      fail++;
      collected[name] = { error: r.reason?.message ?? String(r.reason) };
      console.log(`  ❌ [${name}] 수집 실패 — ${r.reason?.message ?? r.reason}`);
    }
  });

  // DB에 저장.
  // 자정 0시에 돌면 "방금 끝난 어제"가 수집 대상이므로 날짜는 전날(-1).
  try {
    const date = kstDateString(-1);
    const payload = { collectedAt: new Date().toISOString(), channels: collected };
    await saveSnapshot(date, payload);
    console.log(`  💾 저장 완료 → DB (${date})`);
  } catch (e) {
    console.log(`  ⚠️  저장 실패 — ${e.message}`);
  }

  console.log(`[${ts()}] 수집 종료 — 성공 ${ok} / 실패 ${fail}\n`);
  return collected;
}

// 매일 자정 0시 (한국 시간) 스케줄 등록
export function startScheduler() {
  cron.schedule(
    "0 0 * * *",
    () => {
      runCollection().catch((e) => console.error("수집 중 예기치 못한 오류:", e));
    },
    { timezone: "Asia/Seoul" }
  );
  console.log("⏰ 스케줄러 등록됨 — 매일 자정 0시(KST) 자동 수집");
}
