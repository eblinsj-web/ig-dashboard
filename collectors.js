// 채널별 데이터 수집 로직.
// 지금은 인스타그램만 실제로 동작하고, 스레드·네이버 블로그는
// 나중에 각 API를 연동할 자리(placeholder)로 비워둡니다.

import dotenv from "dotenv";
dotenv.config();

const GRAPH = "https://graph.facebook.com/v21.0";
const { ACCESS_TOKEN, IG_ACCOUNT_ID } = process.env;

const METRICS = ["reach", "views", "likes", "comments", "saved", "shares"];

async function graph(url) {
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) {
    const e = new Error(json.error.message);
    e.code = json.error.code;
    throw e;
  }
  return json;
}

async function fetchInsights(mediaId) {
  const out = {};
  const tryMetrics = async (metrics) => {
    const url =
      `${GRAPH}/${mediaId}/insights` +
      `?metric=${metrics.join(",")}&access_token=${ACCESS_TOKEN}`;
    const json = await graph(url);
    for (const m of json.data || []) {
      out[m.name] = m.values?.[0]?.value ?? 0;
    }
  };
  try {
    await tryMetrics(METRICS);
  } catch {
    for (const m of METRICS) {
      try {
        await tryMetrics([m]);
      } catch {
        /* 이 미디어 타입에서 지원 안 되는 지표는 건너뜀 */
      }
    }
  }
  return out;
}

// 인스타그램: 게시물 + 인사이트 수집.
// maxItems만큼 페이징해서 가져옵니다(월별 집계용으로 넉넉히).
export async function collectInstagram(maxItems = 100) {
  if (!ACCESS_TOKEN || !IG_ACCOUNT_ID) {
    throw new Error("ACCESS_TOKEN / IG_ACCOUNT_ID 가 .env에 설정되지 않음");
  }

  // 페이징으로 maxItems까지 수집
  const items = [];
  let url =
    `${GRAPH}/${IG_ACCOUNT_ID}/media` +
    `?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp` +
    `&limit=50&access_token=${ACCESS_TOKEN}`;
  while (url && items.length < maxItems) {
    const page = await graph(url);
    items.push(...(page.data || []));
    url = page.paging?.next || null;
  }
  const sliced = items.slice(0, maxItems);

  const posts = await Promise.all(
    sliced.map(async (item) => {
      const ins = await fetchInsights(item.id);
      const reach = ins.reach ?? 0;
      const likes = ins.likes ?? 0;
      const comments = ins.comments ?? 0;
      const saved = ins.saved ?? 0;
      const shares = ins.shares ?? 0;

      const engagement = likes + comments + saved + shares;
      const reactionRate = reach > 0 ? engagement / reach : null;

      return {
        id: item.id,
        caption: item.caption || "",
        mediaType: item.media_type,
        thumbnail: item.thumbnail_url || item.media_url || null,
        permalink: item.permalink,
        timestamp: item.timestamp,
        metrics: { reach, views: ins.views ?? 0, likes, comments, saved, shares },
        engagement,
        reactionRate,
      };
    })
  );

  // 계정 기본 정보 — 팔로워 수 (followers_count는 인사이트가 아닌 기본 필드)
  let followers = null;
  try {
    const acct = await graph(
      `${GRAPH}/${IG_ACCOUNT_ID}?fields=followers_count,username&access_token=${ACCESS_TOKEN}`
    );
    followers = acct.followers_count ?? null;
    if (followers == null) {
      console.log("  ⚠️  팔로워 수 응답에 followers_count 없음:", JSON.stringify(acct));
    }
  } catch (e) {
    console.log("  ⚠️  팔로워 수 가져오기 실패:", e.message);
  }

  return { followers, posts };
}

// ── 스레드: 추후 Threads API 연동 자리 ───────────────────────────────
export async function collectThreads() {
  // TODO: Threads API(graph.threads.net) 연동.
  // 인스타와 토큰/엔드포인트가 다르므로 별도 설정이 필요함.
  throw new Error("스레드 수집 미구현 (Threads API 연동 필요)");
}

// ── 네이버 블로그: 추후 연동 자리 ────────────────────────────────────
export async function collectNaverBlog() {
  // TODO: 네이버 블로그 통계 연동.
  // 공식 통계 API가 제한적이라 연동 방식 확정 후 구현 예정.
  throw new Error("네이버 블로그 수집 미구현 (연동 방식 미정)");
}

// 채널 목록. 나중에 스레드·네이버가 준비되면 enabled를 true로 바꾸면 됩니다.
export const CHANNELS = [
  { name: "instagram", enabled: true, collect: collectInstagram },
  { name: "threads", enabled: false, collect: collectThreads },
  { name: "naver_blog", enabled: false, collect: collectNaverBlog },
];
