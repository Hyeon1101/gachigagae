/* ─────────────────────────────────────────────────────────────
 * TourAPI 「반려동물 동반여행 서비스」 프록시 (서비스키 보호)
 *
 * 환경변수: TOURAPI_KEY  ← 공공데이터포털 일반 인증키(Decoding)
 *   활용신청: https://www.data.go.kr/data/15135102/openapi.do
 *   설정:     netlify env:set TOURAPI_KEY "발급받은키"
 *
 * 호출: /api/pettour?op=areaBasedList&areaCode=1&contentTypeId=39...
 *  - op 는 접미사 유무가 배포 스펙마다 달라(areaBasedList / areaBasedList1)
 *    자동으로 원형 → +"1" → +"2" 순서로 폴백한다.
 *  - probe=1 을 붙이면 오퍼레이션 진단 결과를 반환 (apitest.html 용)
 * ───────────────────────────────────────────────────────────── */
/* 2026-07 검증 완료: 현행 서비스는 KorPetTourService2 + 오퍼레이션 접미사 "2"
 * (예: areaBasedList2, locationBasedList2, detailPetTour2) — 구버전은 폴백용 유지 */
const { withCors, preflight } = require("../shared/cors");

const BASES = [
  "https://apis.data.go.kr/B551011/KorPetTourService2",
  "https://apis.data.go.kr/B551011/KorPetTourService1"
];
const SUFFIXES = { KorPetTourService2: ["2"], KorPetTourService1: ["", "1"] };
/* 오퍼레이션은 우리가 쓰는 것만 받는다.
 * 예전에는 글자만 걸러서 뭐든 붙였다 — 상류가 어떤 경로를 열어 뒀는지
 * 우리가 모르는 채로 그대로 태워 보내는 셈이고, 캐시 키가 무한히 늘어난다. */
const ALLOWED_OPS = [
  "areaBasedList", "locationBasedList", "searchKeyword", "searchFestival", "searchStay",
  "detailCommon", "detailIntro", "detailInfo", "detailImage", "detailPetTour",
  "areaCode", "categoryCode", "areaBasedSyncList"
];
const ALLOWED_PARAMS = [
  "numOfRows", "pageNo", "arrange", "contentTypeId", "areaCode", "sigunguCode",
  "mapX", "mapY", "radius", "keyword", "contentId", "modifiedtime", "cat1", "cat2", "cat3"
];
const opCache = {}; // opBase → 성공한 전체 URL prefix

async function tryCall(base, op, qs) {
  const url = `${base}/${op}?${qs}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (!json.response) return { ok: false, why: "no response envelope", json };
    const rc = String((json.response.header && json.response.header.resultCode) || "");
    if (rc && rc !== "0000" && rc !== "00") {
      return { ok: false, why: `resultCode=${rc} ${(json.response.header.resultMsg) || ""}`, json };
    }
    return { ok: true, json, url };
  } catch (_) {
    // XML 오류 응답(HTTP ROUTING ERROR, SERVICE KEY 오류 등)
    const m = text.match(/<returnAuthMsg>([^<]+)<|<errMsg>([^<]+)</);
    return { ok: false, why: (m && (m[1] || m[2])) || `HTTP ${res.status} non-JSON`, raw: text.slice(0, 200) };
  }
}

exports.handler = async (event) => {
  const key = process.env.TOURAPI_KEY;
  const q = event.queryStringParameters || {};
  const opBase = (q.op || "areaBasedList").replace(/[^a-zA-Z]/g, "");
  // 관광 데이터는 하루 단위로 갱신되므로 CDN에 길게 캐시한다.
  // (원본 API가 건당 34ms로 느려서, 캐시 적중 시 체감 속도가 크게 달라진다)
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
  };

  // 앱(Capacitor, 오리진 https://localhost)에서도 부를 수 있게 CORS 허용
  Object.assign(headers, withCors({}, event));
  const _pf = preflight(event, headers);
  if (_pf) return _pf;

  if (!ALLOWED_OPS.includes(opBase)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "BAD_OP", allowed: ALLOWED_OPS }) };
  }
  if (!key) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: "NO_KEY", message: "TOURAPI_KEY 환경변수가 설정되지 않았습니다. netlify env:set TOURAPI_KEY <키> 후 재배포하세요." }) };
  }

  const params = new URLSearchParams({
    serviceKey: key,
    MobileOS: "ETC",
    MobileApp: "Gachigagae",
    _type: "json",
    numOfRows: q.numOfRows || "30",
    pageNo: q.pageNo || "1"
  });
  for (const p of ALLOWED_PARAMS) {
    if (Object.prototype.hasOwnProperty.call(q, p) && q[p] != null && q[p] !== "" && !params.has(p)) {
      params.set(p, String(q[p]).slice(0, 200));   // 상류로 나가는 값의 길이는 우리가 정한다
    }
  }
  const qs = params.toString();

  // 진단 모드: 가능한 조합 전부 시도해 결과표 반환
  if (q.probe === "1") {
    const report = [];
    for (const base of BASES) {
      for (const suffix of SUFFIXES[base.split("/").pop()]) {
        const r = await tryCall(base, opBase + suffix, qs);
        report.push({ endpoint: `${base}/${opBase}${suffix}`, ok: r.ok, why: r.why || "OK" });
      }
    }
    return { statusCode: 200, headers, body: JSON.stringify({ probe: report }, null, 2) };
  }

  // 캐시된 성공 경로 우선
  const candidates = [];
  if (opCache[opBase]) candidates.push(opCache[opBase]);
  for (const base of BASES) {
    for (const suffix of SUFFIXES[base.split("/").pop()]) {
      const c = { base, op: opBase + suffix };
      if (!candidates.some(x => x.base === c.base && x.op === c.op)) candidates.push(c);
    }
  }

  let lastWhy = "";
  for (const c of candidates) {
    const r = await tryCall(c.base, c.op, qs);
    if (r.ok) {
      opCache[opBase] = c;
      return { statusCode: 200, headers, body: JSON.stringify(r.json) };
    }
    lastWhy = r.why;
  }
  return { statusCode: 502, headers, body: JSON.stringify({ error: "UPSTREAM_FAIL", message: lastWhy }) };
};
