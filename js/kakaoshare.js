/* ─────────────────────────────────────────────────────────────
 * 💬 카카오톡 공유 — JavaScript SDK 직결
 *
 *  예전에는 sharer.kakao.com 주소를 그냥 열었다. 그런데 그 주소는 SDK가
 *  서명해서 부르는 내부 경로라, 링크만 열면 "잘못된 요청" 화면이 뜬다.
 *  그래서 공식 SDK(Kakao.Share.sendDefault)로 바꿨다 —
 *    · 휴대폰: 카카오톡 앱이 곧바로 열리고 보낼 친구를 고른다
 *    · PC:     카카오톡으로 보내기 창(친구 선택)이 뜬다
 *
 *  SDK는 「카카오톡 공유를 누른 순간」에만 내려받는다. 안 쓰면 요청조차 없다.
 *  키는 지도와 같은 JavaScript 키를 쓰므로 따로 발급할 것이 없다.
 *  다만 카카오 콘솔 > 플랫폼 > Web 에 그 도메인이 등록돼 있어야 한다
 *  (미등록 도메인이면 SDK가 거부한다 → 부르는 쪽에서 문구 복사로 폴백).
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
  var CFG = window.PETMAP_CONFIG || {};
  var KEYS = CFG.KAKAO_JS_KEYS || [];

  var loading = null;

  function loadSdk() {
    if (window.Kakao && window.Kakao.Share) return Promise.resolve(window.Kakao);
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = SDK;
      s.async = true;
      s.onload = function () { resolve(window.Kakao); };
      s.onerror = function () { loading = null; reject(new Error("kakao sdk load fail")); };
      document.head.appendChild(s);
    });
    return loading;
  }

  /** 지도와 같은 키 목록을 순서대로 시도한다 — 하나라도 초기화되면 그 키를 쓴다 */
  function init(K) {
    if (K.isInitialized && K.isInitialized()) return true;
    for (var i = 0; i < KEYS.length; i++) {
      try {
        K.init(KEYS[i]);
        if (K.isInitialized()) return true;
      } catch (_) {}
    }
    return false;
  }

  /** 사용할 수 있는 상태인지 — 키가 아예 없으면 버튼을 숨기는 쪽이 낫다 */
  function available() { return KEYS.length > 0; }

  /** 지금 당장(비동기 없이) 보낼 수 있는 상태인가 */
  function ready() {
    var K = window.Kakao;
    return !!(K && K.Share && K.isInitialized && K.isInitialized());
  }

  /* ⚠️ 팝업 차단 때문에 미리 데워 둔다.
   * 공유 버튼을 누른 뒤에 SDK 를 받아 오면, 그 사이 사용자의 클릭 자격이 끊겨
   * 카카오 창을 window.open 할 때 브라우저가 막아 버린다(아무 일도 안 일어난 것처럼 보인다).
   * 그래서 공유 UI 가 열리는 순간 미리 받아 두고, 실제 클릭에서는 곧바로 보낸다. */
  function warm() {
    if (!available() || ready()) return;
    loadSdk().then(function (K) { init(K); }).catch(function () {});
  }

  function send(o) {
    var K = window.Kakao;
    var link = { mobileWebUrl: o.link, webUrl: o.link };
    try {
      K.Share.sendDefault({
        objectType: "feed",
        content: {
          title: o.title || "같이가개",
          description: o.description || "",
          imageUrl: o.imageUrl || "",
          link: link
        },
        buttons: [{ title: o.buttonTitle || "같이가개에서 보기", link: link }]
      });
    } catch (_) {
      /* 대표 이미지가 카카오 쪽에서 거부되는 경우가 있다(내부망·확장자 등)
       * → 이미지 없는 기본 텍스트 형태로 한 번 더 시도한다 */
      K.Share.sendDefault({
        objectType: "text",
        text: [o.title, o.description].filter(Boolean).join("\n"),
        link: link
      });
    }
  }

  /**
   * 카카오톡으로 보내기.
   * @param {{title:string, description:string, imageUrl:string, link:string, buttonTitle:string}} o
   * @returns {Promise} 성공하면 resolve, 열지 못하면 reject (부르는 쪽에서 폴백)
   */
  function share(o) {
    if (!available()) return Promise.reject(new Error("no kakao key"));
    // 이미 데워져 있으면 클릭 자격이 살아 있는 이 자리에서 바로 보낸다(팝업 차단 회피)
    if (ready()) {
      try { send(o); return Promise.resolve(); }
      catch (e) { return Promise.reject(e); }
    }
    return loadSdk().then(function (K) {
      /* ⚠️ SDK v2 는 init 전까지 Kakao 에 VERSION·init·isInitialized 만 있다.
       * Share·Auth 같은 기능은 init() 이 끝난 뒤에야 붙으므로, 순서를 지켜야 한다
       * (init 전에 Kakao.Share 를 확인하면 항상 없다고 나온다). */
      if (!K || typeof K.init !== "function") throw new Error("kakao sdk missing");
      if (!init(K) || !K.Share) throw new Error("kakao init fail");
      send(o);
    });
  }

  window.PetKakao = { share: share, warm: warm, ready: ready, available: available };
})();
