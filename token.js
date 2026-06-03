// 토큰 관리: 현재 토큰 가져오기 + 자동 갱신.
//
// 동작:
// - 갱신된 토큰은 DB(settings 테이블, key="access_token")에 저장됨.
// - getCurrentToken(): DB에 갱신된 토큰이 있으면 그걸, 없으면 .env의 ACCESS_TOKEN.
// - maybeRefreshToken(): 토큰이 발급/갱신된 지 50일 넘었으면 새 60일 토큰으로 교환.
//
// Facebook Login 방식(EAA 토큰)이라 갱신에 App ID + App Secret이 필요함.

import dotenv from "dotenv";
import { getSetting, setSetting } from "./db.js";
dotenv.config();

const GRAPH = "https://graph.facebook.com/v21.0";
const { ACCESS_TOKEN, FB_APP_ID, FB_APP_SECRET } = process.env;

const TOKEN_KEY = "access_token";
const TOKEN_DATE_KEY = "access_token_updated";

// 현재 사용할 토큰. DB에 갱신본이 있으면 우선, 없으면 .env 값.
export async function getCurrentToken() {
  try {
    const saved = await getSetting(TOKEN_KEY);
    if (saved?.value) return saved.value;
  } catch {
    /* DB 조회 실패 시 env로 폴백 */
  }
  return ACCESS_TOKEN;
}

// 토큰이 마지막으로 갱신된(또는 처음 저장된) 시각. 없으면 null.
async function lastRefreshedAt() {
  try {
    const rec = await getSetting(TOKEN_DATE_KEY);
    return rec?.value ? new Date(rec.value) : null;
  } catch {
    return null;
  }
}

// 50일 넘었으면 토큰 갱신. 갱신했으면 true, 아니면 false.
export async function maybeRefreshToken() {
  if (!FB_APP_ID || !FB_APP_SECRET) {
    console.log("  ℹ️  토큰 자동갱신 비활성 (FB_APP_ID / FB_APP_SECRET 미설정)");
    return false;
  }

  const last = await lastRefreshedAt();
  // 기준 시각이 없으면(최초) 지금 토큰을 한 번 갱신해 기준을 만든다.
  if (last) {
    const days = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
    if (days < 50) {
      return false; // 아직 갱신할 때 아님
    }
  }

  const current = await getCurrentToken();
  try {
    // 장기 토큰 → 새 장기 토큰으로 교환 (fb_exchange_token)
    const url =
      `${GRAPH}/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${FB_APP_ID}` +
      `&client_secret=${FB_APP_SECRET}` +
      `&fb_exchange_token=${current}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.error || !json.access_token) {
      console.log("  ⚠️  토큰 갱신 실패:", json.error?.message || "access_token 없음");
      return false;
    }
    await setSetting(TOKEN_KEY, json.access_token);
    await setSetting(TOKEN_DATE_KEY, new Date().toISOString());
    console.log("  🔑 토큰 갱신 완료 (새 60일 토큰 저장)");
    return true;
  } catch (e) {
    console.log("  ⚠️  토큰 갱신 중 오류:", e.message);
    return false;
  }
}
