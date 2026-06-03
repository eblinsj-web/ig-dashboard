// 일회성 시드 스크립트: 2026-05-31 팔로워 기준값을 DB에 넣는다.
// 실행: node seed.js
// (6월 팔로워 증감 비교의 기준점이 되는 전월 말일 값)

import { initDb, saveSnapshot } from "./db.js";

const DATE = "2026-05-31";
const FOLLOWERS = 6374;

await initDb();
await saveSnapshot(DATE, {
  collectedAt: new Date().toISOString(),
  channels: { instagram: { followers: FOLLOWERS, posts: [] } },
});
console.log(`✅ ${DATE} 팔로워 ${FOLLOWERS}명 DB에 저장 완료`);
process.exit(0);
