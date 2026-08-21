/* ─────────────────────────────────────────────────────────────
 * CORS 허용 오리진 — 웹사이트 + 안드로이드 앱(Capacitor) 공용
 *
 * 앱은 자산을 기기 안에 담고 API만 이 서버로 부른다. 그때 WebView 오리진이
 * https://localhost 이므로, 허용 목록에 없으면 브라우저 단계에서 차단된다.
 *
 * 도메인을 .com 으로 옮길 때:
 *   netlify env:set APP_ORIGINS "https://example.com,https://www.example.com"
 * 로 넣으면 재배포만으로 추가된다(코드 수정 불필요).
 * ───────────────────────────────────────────────────────────── */
const STATIC_ALLOW = [
  "https://ggagae.com",       // 정식 도메인 (대표값 — Origin 헤더가 없을 때 쓰인다)
  "https://www.ggagae.com",
  "https://gachigagae.netlify.app",
  "https://localhost",        // Capacitor Android (androidScheme: https)
  "http://localhost",         // Capacitor 폴백 / 로컬 정적 서버
  "capacitor://localhost",    // iOS(추후)
  "ionic://localhost"
];

/** localhost 는 포트가 붙어도 허용 — 로컬 개발 서버 포트가 자주 바뀐다 */
const LOCALHOST_RE = /^https?:\/\/localhost(:\d+)?$/;

function allowList() {
  const extra = (process.env.APP_ORIGINS || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  return STATIC_ALLOW.concat(extra);
}

/** 요청 오리진이 허용 목록에 있으면 그 값을, 없으면 대표 도메인을 돌려준다 */
function pickOrigin(event) {
  const h = (event && event.headers) || {};
  const origin = h.origin || h.Origin || "";
  if (!origin) return STATIC_ALLOW[0];
  if (LOCALHOST_RE.test(origin)) return origin;
  return allowList().includes(origin) ? origin : STATIC_ALLOW[0];
}

/** 기존 헤더 객체에 CORS 헤더를 얹어 새 객체로 반환 */
function withCors(headers, event) {
  return Object.assign({}, headers, {
    "Access-Control-Allow-Origin": pickOrigin(event),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    /* netlify.toml 의 [[headers]] 는 정적 파일에만 붙고 함수 응답에는 안 붙는다.
     * 함수는 전부 JSON 을 돌려주므로, 브라우저가 내용을 보고 타입을 멋대로
     * 추측(HTML 로 해석)하지 못하게 여기서 직접 얹는다. */
    "X-Content-Type-Options": "nosniff",
    // 오리진마다 응답이 달라지므로 CDN이 섞어 주지 않게 한다
    Vary: "Origin"
  });
}

/** OPTIONS 프리플라이트면 즉시 응답 객체를, 아니면 null 을 반환 */
function preflight(event, headers) {
  const method = (event && (event.httpMethod || event.method)) || "";
  if (method !== "OPTIONS") return null;
  return { statusCode: 204, headers: withCors(headers, event), body: "" };
}

module.exports = { withCors, preflight, pickOrigin };
