/* ─────────────────────────────────────────────────────────────
 * 추가 공공데이터 프록시 (odcloud 자동변환 오픈API)
 *
 * [1] 문화정보원_전국 반려동물 동반 가능 문화시설 (70,650건)
 *     https://www.data.go.kr/data/15111389/fileData.do  → 활용신청 필요
 * [2] 행정안전부_동물병원 (9,445건)
 *     https://www.data.go.kr/data/15045050/fileData.do  → 활용신청 필요
 *
 * 두 데이터 모두 TOURAPI_KEY와 동일한 공공데이터포털 인증키를 사용한다.
 * (data.go.kr 인증키는 계정 단위이며, 각 데이터에 활용신청만 하면 공유된다)
 *
 * 호출: /api/extra?src=culture&page=1&perPage=100&keyword=서울
 *       /api/extra?src=vet&page=1&perPage=100&keyword=강남
 *       /api/extra?src=...&probe=1   ← 신청 상태 진단
 * ───────────────────────────────────────────────────────────── */
const { withCors, preflight } = require("../shared/cors");

const SOURCES = {
  culture: {
    label: "한국문화정보원 반려동물 동반 가능 문화시설",
    url: "https://api.odcloud.kr/api/15111389/v1/uddi:41944402-8249-4e45-9e9d-a52d0a7db1cc",
    applyUrl: "https://www.data.go.kr/data/15111389/fileData.do"
  },
  /* 동물병원(9,445건) — 정확한 요청주소는 활용신청 후 마이페이지에서만 확인 가능.
   * 후보: 전국동물병원표준데이터(15155679) / 행안부 동물병원 조회서비스(15154952)
   * 신청 후 발급된 요청주소를 환경변수 VET_API_URL 에 넣으면 즉시 연결된다.
   *   netlify env:set VET_API_URL "https://api.odcloud.kr/api/15155679/v1/uddi:..."
   * 미설정 시 앱은 카카오맵 지역 검색으로 자동 대체된다. */
  vet: {
    label: "전국 동물병원 표준데이터",
    url: process.env.VET_API_URL || "",
    applyUrl: "https://www.data.go.kr/data/15155679/standard.do"
  }
};

const ERR_HINT = {
  "-4": "이 데이터에 대한 활용신청이 아직 승인되지 않았습니다.",
  "-3": "등록되지 않은 서비스입니다(엔드포인트 확인 필요).",
  "-5": "일시적으로 사용할 수 없는 서비스입니다."
};

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=600" };
  // 앱(Capacitor, 오리진 https://localhost)에서도 부를 수 있게 CORS 허용
  Object.assign(headers, withCors({}, event));
  const _pf = preflight(event, headers);
  if (_pf) return _pf;

  const key = process.env.TOURAPI_KEY;
  // hasOwnProperty 로 확인한다 — 그냥 SOURCES[q.src] 면 src=constructor 같은 값이
  // 프로토타입 체인에 걸려 "있는 것"처럼 통과한다
  const src = Object.prototype.hasOwnProperty.call(SOURCES, q.src) ? SOURCES[q.src] : null;

  if (!src) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "BAD_SRC", allowed: Object.keys(SOURCES) }) };
  }
  if (!key) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: "NO_KEY", message: "TOURAPI_KEY 환경변수가 없습니다." }) };
  }
  if (!src.url) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        error: "NOT_CONFIGURED",
        hint: `${src.label} 요청주소가 아직 설정되지 않았습니다.`,
        label: src.label,
        applyUrl: src.applyUrl
      })
    };
  }

  const params = new URLSearchParams({
    serviceKey: key,
    // 상류에 보낼 숫자는 숫자로만 — 그리고 한 번에 퍼 갈 수 있는 양에 상한을 둔다
    page: String(Math.max(1, parseInt(q.page, 10) || 1)),
    perPage: String(Math.min(1000, Math.max(1, parseInt(q.perPage, 10) || 100))),
    returnType: "JSON"
  });
  // 서버측 필터: 한글 컬럼명 조합은 여기서 만든다(클라이언트는 ASCII 파라미터만 전달)
  if (q.cat) params.set("cond[카테고리2::EQ]", q.cat);
  if (q.cat3) params.set("cond[카테고리3::EQ]", q.cat3);
  if (q.sido) params.set("cond[시도 명칭::EQ]", q.sido);
  if (q.sigungu) params.set("cond[시군구 명칭::EQ]", q.sigungu);
  /* 원시 cond 직접 전달도 허용하되 모양을 검사한다.
   * 예전에는 cond[ 로 시작하기만 하면 뭐든 상류 필터로 그대로 넘겼다 —
   * 우리가 의도하지 않은 조건을 남이 마음대로 끼워 넣을 수 있었다. */
  const COND_RE = /^cond\[[\w가-힣 ()]{1,40}::(EQ|LIKE|GT|GTE|LT|LTE)\]$/;
  let condCount = 0;
  for (const [k, v] of Object.entries(q)) {
    if (!k.startsWith("cond[") || !v) continue;
    if (!COND_RE.test(k) || ++condCount > 5) continue;
    params.set(k, String(v).slice(0, 100));
  }

  try {
    const res = await fetch(`${src.url}?${params.toString()}`);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch (_) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: "BAD_UPSTREAM", raw: text.slice(0, 200) }) };
    }

    // odcloud 오류 응답: {code:-4, msg:"등록되지 않은 인증키 입니다."}
    if (json.code != null && json.code < 0) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          error: "NOT_APPLIED",
          code: json.code,
          message: json.msg,
          hint: ERR_HINT[String(json.code)] || json.msg,
          label: src.label,
          applyUrl: src.applyUrl
        })
      };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ label: src.label, ...json }) };
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: "FETCH_FAIL", message: String(e).slice(0, 200) }) };
  }
};
