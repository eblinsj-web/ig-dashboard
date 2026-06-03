// 집계 로직.
// - getFollowerTrend: DB 스냅샷의 일별 팔로워 수 + 전월 말일 대비 증감
// - getMonthlyRollup: 게시물 timestamp 기준 2026년 월별 집계

import { getAllSnapshots } from "./db.js";

// 모든 스냅샷을 읽어 { "YYYY-MM-DD": followerCount } 맵으로 반환
async function readFollowerByDate() {
  const snaps = await getAllSnapshots();
  const byDate = {};
  for (const [date, snap] of Object.entries(snaps)) {
    const followers = snap?.channels?.instagram?.followers;
    if (followers != null) byDate[date] = followers;
  }
  return byDate;
}

// 특정 연-월(prefix "YYYY-MM")의 마지막 날짜 팔로워 값을 반환 (없으면 null)
function lastValueOfMonth(byDate, prefix) {
  const keys = Object.keys(byDate).filter((d) => d.startsWith(prefix)).sort();
  return keys.length ? byDate[keys[keys.length - 1]] : null;
}

// 현재 월의 일별 팔로워 표 + 전월 말일 대비 증감.
// 오늘(가장 최근) 팔로워 수 + 전월 말일 대비 증감 한 시점만 반환
export async function getFollowerTrend() {
  const byDate = await readFollowerByDate();
  const allDates = Object.keys(byDate).sort();
  if (allDates.length === 0) {
    return { date: null, followers: null, baseline: null, baselineMonth: null, delta: null };
  }

  // 가장 최근 날짜 = 오늘 기준 시점
  const today = allDates[allDates.length - 1];
  const followers = byDate[today];
  const targetMonth = today.slice(0, 7);

  // 전월 말일 팔로워 (비교 기준점)
  const [y, m] = targetMonth.split("-").map(Number);
  const prevDate = new Date(Date.UTC(y, m - 1, 1)); // 이번 달 1일
  prevDate.setUTCDate(0); // 하루 빼면 전월 말일
  const prevPrefix = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const baseline = lastValueOfMonth(byDate, prevPrefix);

  // 최근 30일치 (날짜 오름차순) — 그래프용
  const recent30 = allDates.slice(-30).map((d) => ({ date: d, followers: byDate[d] }));

  return {
    date: today,
    followers,
    baseline,
    baselineMonth: prevPrefix,
    delta: baseline != null ? followers - baseline : null,
    recent30,
  };
}

// 2026년 월별 집계: 평균 도달, 평균 인게이지먼트, 평균 반응율, 게시물 수
export function getMonthlyRollup(posts, year = 2026) {
  const months = {}; // "01".."12"
  for (const p of posts) {
    if (!p.timestamp) continue;
    const d = new Date(p.timestamp);
    if (d.getUTCFullYear() !== year) continue;
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    if (!months[m]) {
      months[m] = { month: m, posts: 0, totalReach: 0, totalEngagement: 0, rateSum: 0, rateCount: 0 };
    }
    const bucket = months[m];
    bucket.posts += 1;
    bucket.totalReach += p.metrics?.reach ?? 0;
    bucket.totalEngagement += p.engagement ?? 0;
    if (p.reactionRate != null) {
      bucket.rateSum += p.reactionRate;
      bucket.rateCount += 1;
    }
  }

  return Object.values(months)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((b) => ({
      month: b.month,
      posts: b.posts,
      // 게시물 1개당 평균값 (총합 ÷ 게시물 수)
      avgReach: b.posts > 0 ? b.totalReach / b.posts : 0,
      avgEngagement: b.posts > 0 ? b.totalEngagement / b.posts : 0,
      avgReactionRate: b.rateCount > 0 ? b.rateSum / b.rateCount : null,
    }));
}
