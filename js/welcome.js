/* ─────────────────────────────────────────────────────────────
 * 👋 앱 첫 화면 — 로그인할지 그냥 쓸지 먼저 고른다 (앱 전용)
 *
 *  앱을 켜면 로고 스플래시가 잠깐 뜨는데, 그동안 화면이 비어 있었다.
 *  그 자리에서 두 갈래를 바로 고르게 한다.
 *
 *    [구글로 로그인]     즐겨찾기가 계정에 남는다
 *    [로그인 없이 사용]  검색·지도·퀴즈는 그대로 전부 쓴다
 *
 *  · 한 번 고르면 다시 묻지 않는다(localStorage). 로그인하면 즉시 닫힌다.
 *  · 웹에서는 나타나지 않는다 — IS_NATIVE_APP 일 때만 만든다.
 *  · 어떤 선택을 하든 앱은 그대로 동작한다. 막는 문이 아니라 안내다.
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var CFG = window.PETMAP_CONFIG || {};
  if (!CFG.IS_NATIVE_APP) return;

  var T = function (k, v) { return window.T ? window.T(k, v) : k; };

  /* 이미 로그인해 둔 사람에게 또 물을 이유가 없다 */
  function alreadyIn() {
    return !!(window.PetAccount && window.PetAccount.user && window.PetAccount.user());
  }

  var el = null;

  function close() {
    if (!el) return;
    el.classList.remove("show");
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); el = null; }, 220);
  }

  function build() {
    el = document.createElement("div");
    el.className = "wc-gate";
    el.innerHTML =
      '<div class="wc-card">' +
        '<div class="wc-mark" data-mark></div>' +
        '<b class="wc-title">' + T("wc.title") + "</b>" +
        '<p class="wc-lead">' + T("wc.lead") + "</p>" +
        '<div class="wc-gsi" id="wcGsi"></div>' +
        '<button type="button" class="wc-skip" id="wcSkip">' + T("wc.skip") + "</button>" +
        '<span class="wc-note">' + T("wc.note") + "</span>" +
      "</div>";
    document.body.appendChild(el);

    if (window.Icon && window.Icon.hydrate) window.Icon.hydrate(el);

    el.querySelector("#wcSkip").addEventListener("click", close);

    /* 구글 버튼은 favorites.js 가 이미 공식 버튼을 그릴 줄 안다 — 그대로 빌려 쓴다.
     * 클라이언트 ID 가 없으면 로그인 줄 자체가 사라지고 [그냥 쓰기]만 남는다. */
    var host = el.querySelector("#wcGsi");
    if (window.PetFav && window.PetFav.mountLogin) {
      window.PetFav.mountLogin(host);
    } else {
      host.style.display = "none";
    }

    // 로그인에 성공하면 물어볼 것이 없어진다
    if (window.PetAccount && window.PetAccount.onChange) {
      window.PetAccount.onChange(function (u) { if (u) close(); });
    }

    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () { if (el) el.classList.add("show"); }, 60);  // rAF 안 도는 환경 대비
  }

  function start() {
    /* ⚠️ 예전에는 "한 번 고르면 다시 묻지 않는다"(localStorage 표시)였다.
     * 그런데 그 한 번을 [로그인 없이 사용하기]로 넘긴 사람에게는 로그인 버튼이
     * 영영 사라진 것처럼 보였다(2026-08-18 사용자 신고 — "로그인 기능이 없어졌다").
     * 로그인은 언제든 다시 할 수 있어야 하므로, 기준을 표시가 아니라 상태로 바꾼다.
     *   로그인 안 된 상태 → 켤 때마다 두 갈래를 보여 준다(넘기는 건 한 번 누르면 끝)
     *   로그인 된 상태     → 다시 묻지 않는다 */
    if (alreadyIn()) return;
    build();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
