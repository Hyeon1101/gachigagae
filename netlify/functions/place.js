/* ─────────────────────────────────────────────────────────────
 * 장소 실사용 정보 조회 (네이버 플레이스, 키 불필요)
 *
 * 공공데이터에는 평점·후기가 없어 "여기 진짜 갈 만한가?"를 알 수 없다.
 * m.place.naver.com 모바일 페이지의 window.__APOLLO_STATE__ 에
 * 평점·리뷰수·카테고리·전화·대표사진·방문자 리뷰 본문이 모두 들어 있다.
 *
 * GET /api/place?q=상호명&x=경도&y=위도&addr=주소&full=1
 *   → { found, id, name, category, rating, reviewCount, blogCount,
 *       phone, roadAddress, thumb, url, reviews:[{rating, body, nick}] }
 *
 * CDN에 24시간 캐시한다(평점은 하루 단위로 바뀌어도 무방).
 * ───────────────────────────────────────────────────────────── */
const { withCors, preflight } = require("../shared/cors");
const { take } = require("../shared/ratelimit");

/* 이 주소는 네이버를 대신 두드려 주는 창구다. 제한이 없으면 남이 우리를
 * 스크래핑 통로로 쓰고, 그러다 차단당하는 건 우리 쪽이다.
 * 목록 한 벌이 최대 150건(동시 2건)이라 실제 사용자는 여기 걸릴 일이 없다.
 * (게다가 성공 응답은 CDN에 24시간 남아 함수까지 오지도 않는다) */
const RATE = { limit: Number(process.env.PLACE_RATE_LIMIT || 240), windowMs: 60000 };

/** 네이버가 준 장소 id — 주소 경로에 그대로 끼워 넣기 전에 모양을 확인한다 */
const isPlaceId = (v) => /^[A-Za-z0-9_-]{1,32}$/.test(String(v || ""));

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getHtml(url, retry = 1) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
      "Referer": "https://m.place.naver.com/"
    }
  });
  // 네이버는 짧은 시간에 몰아 치면 429를 준다 → 한 번만 쉬었다 다시
  if (res.status === 429 && retry > 0) {
    await sleep(800);
    return getHtml(url, retry - 1);
  }
  if (!res.ok) {
    const err = new Error(`naver ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.text();
}

/** window.__APOLLO_STATE__ = {...} 를 중괄호 균형으로 잘라낸다.
 *  정규식으로 `};</script>` 를 찾으면 본문에 같은 문자열이 있어 깨진다. */
function apollo(html) {
  const key = "window.__APOLLO_STATE__ =";
  let i = html.indexOf(key);
  if (i < 0) return null;
  i = html.indexOf("{", i);
  if (i < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < html.length; j++) {
    const ch = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      if (--depth === 0) {
        try { return JSON.parse(html.slice(i, j + 1)); } catch (_) { return null; }
      }
    }
  }
  return null;
}

const pick = (state, prefix) =>
  Object.keys(state || {}).filter(k => k.indexOf(prefix) === 0).map(k => state[k]);

/** 상호명 정규화 — 지점 표기·괄호·특수문자를 걷어내 검색 적중률을 올린다 */
function cleanName(s) {
  return String(s || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[·・]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 이름이 서로 같은 곳을 가리키는지 — 공백·특수문자 무시하고 포함 관계 확인 */
function nameMatches(a, b) {
  const na = String(a || "").toLowerCase().replace(/[\s()·・,.-]/g, "");
  const nb = String(b || "").toLowerCase().replace(/[\s()·・,.-]/g, "");
  if (!na || !nb) return false;
  return na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0;
}

/** 같은 시·군·구인지 — 이름만 비슷한 다른 지역 가게를 걸러 낸다.
 *  틀린 평점을 보여 주는 건 헛걸음 방지 서비스에서 가장 나쁜 실패라 보수적으로 판단한다. */
function gu(addr) {
  const m = String(addr || "").match(/([가-힣]{2,10}?[시군구])(?=\s|$)/g);
  return m ? m[m.length - 1] : "";
}
function addrAgrees(mine, theirs) {
  const a = gu(mine), b = gu(theirs);
  if (!a || !b) return true;          // 한쪽이라도 없으면 판단 보류(이름 일치로만 결정)
  return a === b;
}

async function search(q, x, y) {
  const params = new URLSearchParams({ query: q });
  if (x && y) { params.set("x", x); params.set("y", y); }
  const url = `https://m.place.naver.com/restaurant/list?${params}`;
  const state = apollo(await getHtml(url));
  return pick(state, "PlaceListBusinessesItem");
}

async function detail(id, wantReviews) {
  const out = {};
  if (!isPlaceId(id)) return out;
  const state = apollo(await getHtml(`https://m.place.naver.com/restaurant/${id}/home`));
  const base = pick(state, "PlaceDetailBase")[0];
  if (base) {
    out.name = base.name;
    out.category = base.category;
    out.rating = base.visitorReviewsScore;
    out.reviewCount = base.visitorReviewsTotal;
    out.blogCount = base.cafeBlogReviewsTotal;
    out.phone = base.phone || base.virtualPhone || "";
    out.roadAddress = base.roadAddress || base.address || "";
  }
  const photo = pick(state, "PlaceDetailTopPhotoItem")[0];
  if (photo) {
    const src = photo.thumbnailUrl || photo.originalUrl || "";
    // ldb-phinf 호스트만 ?type= 리사이즈를 받는다 (f300_300 / w1500_60_sharpen)
    const resizable = /ldb-phinf\.pstatic\.net/.test(src);
    const base = src.split("?")[0];
    out.thumb = resizable ? base + "?type=f300_300" : src;   // 목록 카드용 (작게)
    out.photo = resizable ? base + "?type=w1500_60_sharpen" : src;  // 상세 대표사진용
  }
  if (wantReviews) {
    try {
      const rs = apollo(await getHtml(`https://m.place.naver.com/restaurant/${id}/review/visitor`));
      const authors = {};
      pick(rs, "VisitorReviewAuthor").forEach((a, i) => { authors[i] = a; });
      out.reviews = pick(rs, "VisitorReview:")
        .filter(r => r && r.body && String(r.body).trim())
        .slice(0, 3)
        .map(r => ({
          rating: r.rating || null,
          body: String(r.body).replace(/\s+/g, " ").trim().slice(0, 160)
        }));
    } catch (_) { out.reviews = []; }
  }
  return out;
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=600, s-maxage=86400"
  };
  // 앱(Capacitor, 오리진 https://localhost)에서도 부를 수 있게 CORS 허용
  Object.assign(headers, withCors({}, event));
  const _pf = preflight(event, headers);
  if (_pf) return _pf;

  const gate = take(event, RATE);
  if (!gate.ok) {
    return {
      statusCode: 429,
      headers: Object.assign({}, headers, { "Retry-After": String(gate.retryAfter), "Cache-Control": "no-store" }),
      body: JSON.stringify({ found: false, error: "RATE_LIMITED", throttled: true })
    };
  }

  const p = event.queryStringParameters || {};
  // 밖에서 온 값은 길이·모양을 우리가 정한다 (상호명은 아무리 길어도 100자면 넉넉하다)
  const q = cleanName(p.q).slice(0, 100);
  const num = (v) => (/^-?\d{1,3}(\.\d{1,10})?$/.test(String(v || "")) ? String(v) : "");
  p.x = num(p.x);
  p.y = num(p.y);
  p.addr = String(p.addr || "").slice(0, 120);
  if (!q) return { statusCode: 400, headers, body: JSON.stringify({ error: "NO_QUERY" }) };

  // 「이름이 일치 + 같은 시·군·구」인 후보만 채택한다.
  // 첫 결과를 그냥 쓰면 "2Cats"(종로) → 엉뚱한 왕십리 분양샵 평점이 붙는다.
  async function resolve(query) {
    const items = await search(query, p.x, p.y);
    const cands = items.filter(it => nameMatches(it.name, q) && isPlaceId(it.id)).slice(0, 2);
    for (const hit of cands) {
      const d = await detail(hit.id, p.full === "1");
      // 목록의 roadAddress는 시·구가 빠져 있어 상세의 전체 주소로 지역을 확인한다
      if (!addrAgrees(p.addr, d.roadAddress || hit.roadAddress)) continue;
      return Object.assign({
        found: true,
        id: hit.id,
        name: hit.name,
        category: hit.category,
        rating: hit.visitorReviewScore ? parseFloat(hit.visitorReviewScore) : null,
        reviewCount: hit.visitorReviewCount
          ? parseInt(String(hit.visitorReviewCount).replace(/,/g, ""), 10) : null,
        roadAddress: hit.roadAddress || hit.address || "",
        url: `https://m.place.naver.com/restaurant/${hit.id}/home`
      }, d);
    }
    return null;
  }

  try {
    let out = await resolve(q);
    // 좌표 편향만으로 못 찾거나 다른 동네 가게가 잡히면 지역명을 붙여 한 번 더
    if (!out && p.addr) {
      const area = String(p.addr).split(" ").filter(Boolean).slice(0, 3).join(" ");
      out = await resolve(`${area} ${q}`);
    }
    return {
      statusCode: 200, headers,
      body: JSON.stringify(out || { found: false, q })
    };
  } catch (e) {
    // 실패는 캐시하지 않는다(일시적 429·타임아웃이 하루 동안 굳으면 안 된다)
    // 상류 오류 원문은 로그에만 남긴다 — 응답으로 흘리면 내부 주소가 같이 나간다
    console.error("[place] upstream fail:", e.status || "", e.message);
    return {
      statusCode: 200,
      headers: Object.assign({}, headers, { "Cache-Control": "no-store" }),
      body: JSON.stringify({ found: false, error: "UPSTREAM_FAIL", throttled: e.status === 429 })
    };
  }
};
