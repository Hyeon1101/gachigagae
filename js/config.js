/* ─────────────────────────────────────────────────────────────
 * 같이가개 설정 파일
 *
 * [1] KAKAO_JS_KEY  : 카카오 지도 JavaScript 키 (developers.kakao.com → 앱 생성
 *                     → 플랫폼 Web 도메인 등록 필수: http://localhost:8899, 배포 도메인)
 *                     비워두면 OpenStreetMap 폴백 지도로 동작합니다.
 * [2] TourAPI 키    : 브라우저가 아니라 Netlify 환경변수 TOURAPI_KEY 에 저장합니다.
 *                     (공공데이터포털 → 한국관광공사_반려동물_동반여행_서비스 활용신청
 *                      https://www.data.go.kr/data/15135102/openapi.do)
 *                     → netlify env:set TOURAPI_KEY "일반인증키(Decoding)"
 *
 * [3] 도메인 이전(.com)  : 아래 SERVER_ORIGIN 한 줄만 바꾸면 웹·앱이 함께 옮겨간다.
 *                     같이 해야 하는 것 3가지 —
 *                       ① 카카오 콘솔 > JavaScript SDK 도메인에 새 주소 추가
 *                       ② netlify env:set APP_ORIGINS "https://새도메인" (CORS)
 *                       ③ 앱 재빌드 후 스토어 업데이트 (내장형이라 필수는 아니지만 권장)
 * ───────────────────────────────────────────────────────────── */

/* API가 실제로 살아 있는 주소.
 * 웹에서는 같은 오리진이라 빈 문자열로 두고(상대경로 그대로), 앱에서는 자산이
 * 기기 안에 있어 "/api/…"가 로컬 파일로 잡히므로 반드시 절대주소가 필요하다. */
const SERVER_ORIGIN = "https://ggagae.com";

/* Capacitor 네이티브 컨테이너 안에서 실행 중인지 — 앱이면 true */
const IN_CAPACITOR = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function"
  ? window.Capacitor.isNativePlatform()
  : window.Capacitor && window.Capacitor.isNative);

/* 앱 화면(하단 탭바 등)을 PC 브라우저에서 확인하기 위한 QA 스위치.
 * 로컬 주소에서 ?appmode=1 일 때만 켜진다 — 배포 도메인에서는 절대 켜지지 않는다. */
const QA_APP_MODE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  && /[?&]appmode=1(&|$)/.test(location.search);

const IS_NATIVE_APP = IN_CAPACITOR || QA_APP_MODE;

window.PETMAP_CONFIG = {
  SERVER_ORIGIN,
  IS_NATIVE_APP,
  // 앱이면 절대주소, 웹이면 상대경로. 호출부는 window.API("/api/pettour") 형태로 쓴다.
  API_BASE: IS_NATIVE_APP ? SERVER_ORIGIN : "",
  // 카카오 JavaScript 키 — 배열 순서대로 시도, 모두 실패 시 OSM 폴백
  // [0] "우편번호" 앱(ID 1475455) Default JS Key — 사용 중.
  //     카카오맵 ON + JavaScript SDK 도메인에 http://localhost:8899,
  //     https://gachigagae.netlify.app 등록 완료(2026-08-14 호출 검증).
  //     ※ 새 포트/도메인을 쓰려면 콘솔에 그 주소도 추가해야 함(미등록 시 OSM 폴백)
  // [1][2] 구 "지도" 앱: OPEN_MAP_AND_LOCAL 비활성(403) — 폴백용으로만 유지
  KAKAO_JS_KEYS: ["ccdbd0a681ffb74fefb0372e59d8e14b", "3aebab05370656c99aca1f9b79c19b2a", "b4dde2bf8248f253c7bbc79dd5766971"],
  /* 🔐 구글 로그인 — 선택 기능이다.
   *
   *  비워 두면(기본) 로그인 UI 자체가 화면에 나타나지 않고, 즐겨찾기를 포함한
   *  모든 기능이 게스트 상태로 그대로 동작한다. 값을 넣으면 즐겨찾기 패널에
   *  구글 공식 로그인 버튼이 생기고, 저장 칸이 계정별로 나뉜다.
   *
   *  발급 방법 (백엔드 없이 프런트만으로 끝난다)
   *    ① console.cloud.google.com → 프로젝트 생성
   *    ② API 및 서비스 → OAuth 동의 화면 → External, 앱 이름/이메일만 입력
   *    ③ 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID
   *       · 유형: 웹 애플리케이션
   *       · 승인된 JavaScript 원본:
   *           https://www.ggagae.com
   *           https://ggagae.com
   *           https://gachigagae.netlify.app
   *           http://localhost:8899          (로컬 확인용)
   *       · 리디렉션 URI는 비워 둬도 된다 (팝업 방식이라 쓰지 않는다)
   *    ④ 발급된 "...apps.googleusercontent.com" 을 아래에 붙여넣기
   *
   *  ※ 클라이언트 ID는 원래 공개되는 값이다(원본 도메인으로 보호된다).
   *     클라이언트 시크릿은 이 방식에서 쓰지 않으니 절대 넣지 말 것. */
  GOOGLE_CLIENT_ID: "356161285114-viefvlgftl000h6804pqhbml78uphi4q.apps.googleusercontent.com",

  USE_LIVE_API: true,          // TourAPI(Netlify Function) 우선 사용, 실패 시 샘플데이터
  DEFAULT_CENTER: { lat: 37.5665, lng: 126.9780 },   // 서울시청
  DEFAULT_ZOOM: 12,            // OSM 줌 (카카오 level은 자동 환산)
  NEARBY_RADIUS_M: 3000,       // 근처 관광지 탐색 반경(m)
  APP_NAME: "Gachigagae"
};

/** API 경로를 실행 환경에 맞는 주소로 바꿔 준다 — 웹은 그대로, 앱은 절대주소 */
window.API = function (path) {
  return window.PETMAP_CONFIG.API_BASE + path;
};

/* ─────────────────────────────────────────────────────────────
 * 🖼️ 사진이 깨졌을 때 처리 — 태그마다 붙이던 onerror="…" 를 대신한다.
 *
 * 예전에는 <img onerror="this.outerHTML='…장소id…'"> 처럼 마크업 안에 코드를
 * 적어 넣었다. 그런데 그 자리에 들어가던 장소 id 에는 상호명이 그대로 들어 있어
 * (문화정보원 데이터의 id 는 "culture-상호-위도-경도" 형태다), 상호에 따옴표가
 * 하나만 있어도 남이 등록한 글이 우리 화면에서 코드가 된다.
 * 또 인라인 핸들러가 한 개라도 남아 있으면 CSP(script-src)를 조일 수 없다.
 *
 * error 이벤트는 위로 버블링하지 않지만 캡처 단계에서는 document 까지 내려온다
 * → 여기 한 곳에서 전부 받는다. 사용법은 마크업에 표시만 남기면 된다:
 *     data-imgfail="remove"    사진을 그냥 지운다
 *     data-imgfail="🍽️"        같은 자리를 이모지 상자로 바꾼다(클래스·data-photo 유지)
 * ───────────────────────────────────────────────────────────── */
document.addEventListener("error", function (e) {
  var el = e.target;
  if (!el || el.tagName !== "IMG") return;
  var how = el.getAttribute("data-imgfail");
  if (how === null) return;
  el.removeAttribute("data-imgfail");          // 같은 태그에서 두 번 처리하지 않는다
  if (!how || how === "remove") { if (el.parentNode) el.parentNode.removeChild(el); return; }
  var box = document.createElement("div");
  box.className = el.className;
  var pid = el.getAttribute("data-photo");
  if (pid !== null) box.setAttribute("data-photo", pid);
  box.textContent = how;                        // textContent 라 어떤 글자가 와도 코드가 되지 않는다
  if (el.parentNode) el.parentNode.replaceChild(box, el);
}, true);

/* ─────────────────────────────────────────────────────────────
 * 앱 전용: 우리 서버로 나가는 요청에 시한과 재시도를 붙인다.
 *
 * 브라우저의 fetch 에는 기본 타임아웃이 없다. 웹에서는 크게 문제가 안 되지만
 * 휴대폰에서는 지하철·엘리베이터·기지국 전환처럼 신호가 끊겼다 붙는 일이 잦아,
 * 요청이 성공도 실패도 하지 않은 채 매달린다. 그러면 화면은 "불러오는 중"에서
 * 멈추고 사용자 눈에는 기능이 통째로 죽은 것처럼 보인다.
 *
 * 여기서 한 번에 감싸 두면 호출부(app.js·ai.js·hot.js·extra.js)를 건드리지 않아도
 * 모든 API 호출이 같은 규칙을 따른다. 우리 서버 주소로 가는 요청만 대상이고,
 * 웹에서는 아예 설치되지 않는다(IS_NATIVE_APP 일 때만).
 * ───────────────────────────────────────────────────────────── */
if (IS_NATIVE_APP && typeof window.fetch === "function" && typeof AbortController === "function") {
  const _fetch = window.fetch.bind(window);
  const TIMEOUT_MS = 20000;

  const urlOf = (input) =>
    typeof input === "string" ? input : (input && input.url) || "";

  function once(input, init, ms) {
    const ctrl = new AbortController();
    const outer = init && init.signal;
    if (outer) {                       // 호출부의 취소 신호를 그대로 잇는다
      if (outer.aborted) ctrl.abort();
      else outer.addEventListener("abort", () => ctrl.abort(), { once: true });
    }
    const timer = setTimeout(() => ctrl.abort(), ms);
    const opts = Object.assign({}, init, { signal: ctrl.signal });
    return _fetch(input, opts).then(
      (res) => { clearTimeout(timer); return res; },
      (err) => {
        clearTimeout(timer);
        // 호출부가 직접 취소한 게 아니라면 시간 초과로 본다
        if (err && err.name === "AbortError" && !(outer && outer.aborted)) {
          const e = new Error("요청 시간이 초과되었습니다 (20초)");
          e.timeout = true;
          throw e;
        }
        throw err;
      }
    );
  }

  window.fetch = function (input, init) {
    const url = urlOf(input);
    // 우리 서버가 아니면(카카오 SDK·지도 타일·관광공사 이미지 등) 손대지 않는다
    if (!url || url.indexOf(SERVER_ORIGIN) !== 0) return _fetch(input, init);

    /* 진단 화면은 "지금 이 순간의 진짜 결과"를 보여 줘야 하므로 재시도하지 않는다.
     * 재시도로 가려진 성공은 원인 파악을 오히려 방해한다. */
    const isProbe = /[?&]_(probe|diag)=/.test(url);
    const first = once(input, init, isProbe ? 10000 : TIMEOUT_MS);
    if (isProbe) return first;

    return first.catch((err) => {
      // 호출부가 취소했으면 재시도하지 않는다
      if (init && init.signal && init.signal.aborted) throw err;
      // HTTP 오류(4xx·5xx)는 여기로 오지 않는다 — 연결 자체가 실패한 경우만 한 번 더
      return once(input, init, TIMEOUT_MS);
    });
  };
}
