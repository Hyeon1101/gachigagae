/* ─────────────────────────────────────────────────────────────
 * 같이가개 — 안드로이드 앱 셸 (Capacitor 전용)
 *
 * 웹에서는 아무것도 하지 않는다. 네이티브 컨테이너 안에서 실행될 때만
 * 켜져서, 브라우저 화면을 "앱처럼" 쓰게 만드는 것들을 붙인다.
 *
 *  1) 하단 탭바      — 엄지로 닿는 위치에서 화면 이동
 *  2) 뒤로가기 버튼  — 모달 → 이전 화면 → 두 번 누르면 종료
 *  3) 상태바         — 밝은 배경에 맞춰 아이콘을 어둡게
 *  4) 스플래시       — 첫 화면이 그려진 뒤에 닫는다(흰 화면 깜빡임 방지)
 *  5) 오프라인 표시  — 지하철·엘리베이터에서 왜 안 뜨는지 알려준다
 *
 * app.js 보다 먼저 실행되어야 한다 — 탭바 버튼에 .nav-btn 클래스를 달아 두면
 * app.js 의 bindEvents 가 알아서 showPage 를 물려 준다(중복 배선 없음).
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var CFG = window.PETMAP_CONFIG || {};
  if (!CFG.IS_NATIVE_APP) return;          // ← 웹이면 여기서 끝

  var Cap = window.Capacitor;
  var doc = document;

  /* 플러그인 찾기.
   * native-bridge.js 는 Capacitor.isNativePlatform() 같은 기본만 넣어 주고
   * Capacitor.Plugins 는 채우지 않는다. 실제 객체는 IIFE 래퍼가 만든 전역
   * (capacitorApp.App 등)에 있고, 그 래퍼가 registerPlugin 으로 Capacitor.Plugins
   * 에도 등록한다. 둘 다 없을 수 있으므로 순서대로 찾고, 없으면 조용히 건너뛴다. */
  function plugin(globalName, key) {
    var g = window[globalName];
    if (g && g[key]) return g[key];
    if (Cap && Cap.Plugins && Cap.Plugins[key]) return Cap.Plugins[key];
    return null;
  }

  var AppPlugin    = plugin("capacitorApp", "App");
  var SplashPlugin = plugin("capacitorSplashScreen", "SplashScreen");
  var StatusPlugin = plugin("capacitorStatusBar", "StatusBar");

  doc.documentElement.classList.add("is-app");

  /* ══════════ 0. 네트워크 공통 유틸 ══════════ */

  /* fetch 는 기본 타임아웃이 없다. 모바일에서 신호가 약하면 요청이 끝나지도
   * 실패하지도 않은 채 매달려 있어, 사용자 눈에는 "눌러도 아무 반응이 없는" 앱이 된다.
   * → 앱에서 나가는 우리 서버 요청에는 반드시 시한을 건다. */
  function fetchTimeout(url, init, ms) {
    init = init || {};
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var outer = init.signal;
    if (ctrl && outer) {                       // 호출부가 준 취소 신호도 그대로 이어받는다
      if (outer.aborted) ctrl.abort();
      else outer.addEventListener("abort", function () { ctrl.abort(); }, { once: true });
    }
    var opts = Object.assign({}, init);
    if (ctrl) opts.signal = ctrl.signal;
    var timedOut = false;
    var timer = setTimeout(function () {
      timedOut = true;
      if (ctrl) ctrl.abort();
    }, ms || 20000);

    return fetch(url, opts).then(function (res) {
      clearTimeout(timer);
      return res;
    }, function (err) {
      clearTimeout(timer);
      if (timedOut) {
        var e = new Error("시간 초과 (" + Math.round((ms || 20000) / 1000) + "초)");
        e.timeout = true;
        throw e;
      }
      throw err;
    });
  }

  /** 예외를 사람이 읽을 수 있는 한 줄로 — 진단 화면에 그대로 보여 준다 */
  function describeErr(err) {
    if (!err) return "알 수 없는 오류";
    if (err.timeout) return err.message;
    var m = String(err.message || err);
    // WebView 는 CORS 든 DNS 든 전부 "Failed to fetch" 로 뭉뚱그린다
    if (/failed to fetch|networkerror|load failed/i.test(m)) return "네트워크 실패 (서버에 닿지 못함)";
    if (/abort/i.test(m)) return "요청 취소됨";
    return m;
  }

  /* ══════════ 1. 하단 탭바 ══════════ */

  var TABS = [
    { page: "home",    ic: "home", key: "nav.home", ko: "홈" },
    { page: "results", ic: "list", key: "nav.list", ko: "목록" },
    { page: "map",     ic: "map",  key: "nav.map",  ko: "지도" },
    { page: "tips",    ic: "paw",  key: "nav.tips", ko: "팁" }
  ];

  function buildTabbar() {
    var bar = doc.createElement("nav");
    bar.className = "app-tabbar";
    bar.setAttribute("role", "tablist");

    TABS.forEach(function (t, i) {
      var b = doc.createElement("button");
      // .nav-btn 을 달아 두면 app.js 가 클릭 배선과 active 동기화를 대신해 준다
      b.className = "tab nav-btn" + (i === 0 ? " active" : "");
      b.dataset.page = t.page;
      b.type = "button";
      b.innerHTML = '<i data-ic="' + t.ic + '"></i><b data-i18n="' + t.key + '">' + t.ko + "</b>";
      bar.appendChild(b);
    });
    doc.body.appendChild(bar);

    // 아이콘 자리표시자를 실제 SVG로 — Icon.hydrate 는 innerHTML 교체 뒤에도 필요
    if (window.Icon && window.Icon.hydrate) window.Icon.hydrate();
    // 언어를 바꾸면 라벨과 아이콘이 함께 날아가므로 다시 채운다
    doc.addEventListener("petmap:lang", function () {
      if (window.Icon && window.Icon.hydrate) window.Icon.hydrate();
    });
    return bar;
  }

  /* ══════════ 1-2. 🏠 홈 화면 재구성 ══════════ */

  /* 앱 히어로 그림 갈아 끼우기.
   * 웹의 hero-dog.jpg 는 980KB 짜리 사진이라 디테일이 많다. 웹에서는 큰 지면에
   * 글자를 얹는 배경이라 어울리지만, 앱에서는 118px 짜리 띠로 눌리면서 무슨
   * 사진인지도 모르게 뭉개졌다. 앱용으로는 여백이 넓은 단순한 그림을 쓴다(33KB).
   * 웹 index.html 은 건드리지 않는다 — 앱에서만 바꿔 끼운다. */
  function swapHeroArt() {
    var img = doc.querySelector(".hero-photo");
    if (!img) return;
    img.src = "assets/hero-app.jpg";
    img.alt = "노란 들판에 나란히 앉은 강아지와 고양이";
    img.removeAttribute("fetchpriority");
  }

  /* 배너 빈 자리에 설명 두 줄 얹기.
   *
   * 웹 히어로는 [작은 머리글 / 큰 제목 세 줄 / 설명 한 줄] 인데, 앱에서는 큰 제목이
   * 자리만 차지하고 하는 말이 없다(앱을 연 사람은 이미 무슨 앱인지 안다).
   * 제목은 빼고, 실제로 정보가 있는 위·아래 두 줄만 그림의 빈 왼쪽에 올린다.
   * 글자는 이미지에 굽지 않고 얹는다 — 그래야 영어로 바꿔도 같이 바뀌고
   * 어떤 해상도에서도 또렷하다. */
  function buildHeroCopy() {
    var hero = doc.querySelector(".hero");
    var eyebrow = hero && hero.querySelector(".eyebrow");
    var lead = hero && hero.querySelector(".hero-lead");
    if (!hero || !eyebrow || !lead) return;

    var copy = doc.createElement("div");
    copy.className = "hero-copy";
    copy.appendChild(eyebrow);
    copy.appendChild(lead);
    // 사진 바로 뒤에 놓아 그림 위에 겹치게 한다(.hero 는 position:relative)
    var photo = hero.querySelector(".hero-photo");
    if (photo && photo.nextSibling) hero.insertBefore(copy, photo.nextSibling);
    else hero.appendChild(copy);
  }

  /* 🐶 「우리 아이 정보」 — 홈에서 시트로.
   *
   * 홈에 펼쳐져 있던 등록 폼은 혼자서 429px 를 썼다(품종 AI + 입력 4칸 +
   * 준비물 체크 4개 + 저장 버튼). 홈이 길고 빽빽해 보이던 가장 큰 이유다.
   *
   * 폼을 새로 만들지 않는다 — 있던 DOM 을 그대로 시트 안으로 옮긴다.
   * id 가 유지되므로 app.js 의 renderPetForm()·저장 처리·품종 분류가 전부
   * 손대지 않고 그대로 동작한다. 홈에는 요약 한 줄(아바타 + 상태 배지)만 남는다.
   * 그 요약에 쓰는 #pfAvatar·#pfState 도 원본 노드를 옮겨 붙이는 것이라
   * renderPetForm() 이 갱신하는 대상이 그대로다. */
  function buildPetSheet() {
    var form = doc.getElementById("petForm");
    var head = form && form.querySelector(".pf-head");
    var sec = doc.getElementById("secPet");
    if (!form || !head || !sec) return;

    /* 홈에 남길 요약 카드 — 누르면 시트가 열린다 */
    var entry = doc.createElement("button");
    entry.type = "button";
    entry.id = "petEntry";
    entry.className = "pet-entry";
    entry.innerHTML =
      '<span class="pe-txt"><b data-i18n="pf.cardTitle">우리 아이 정보</b></span>' +
      '<span class="pe-go" aria-hidden="true"></span>';

    // 아바타는 맨 앞, 상태 배지는 제목 아래 — 원본 노드를 그대로 가져다 쓴다
    var avatar = head.querySelector("#pfAvatar");
    var state = head.querySelector("#pfState");
    if (avatar) entry.insertBefore(avatar, entry.firstChild);
    if (state) entry.querySelector(".pe-txt").appendChild(state);

    sec.innerHTML = "";
    sec.appendChild(entry);

    /* 시트 — 헤더 + 옮겨 온 폼 */
    var sheet = doc.createElement("div");
    sheet.id = "petSheet";
    sheet.className = "pet-sheet";
    sheet.innerHTML =
      '<div class="ps-scrim" data-ps-close></div>' +
      '<div class="ps-panel" role="dialog" aria-modal="true" aria-labelledby="psTitle">' +
        '<div class="ps-head">' +
          '<b id="psTitle" data-i18n="pf.title">내 반려동물 정보 등록</b>' +
          '<button type="button" id="petSheetClose" class="ps-close" data-ps-close>' +
            '<i data-ic="close"></i></button>' +
        '</div>' +
        '<div class="ps-body"></div>' +
      "</div>";
    doc.body.appendChild(sheet);

    head.parentNode.removeChild(head);          // 제목줄은 시트 헤더가 대신한다
    sheet.querySelector(".ps-body").appendChild(form);

    function open() {
      sheet.classList.add("show");
      doc.documentElement.classList.add("ps-open");
    }
    function close() {
      sheet.classList.remove("show");
      doc.documentElement.classList.remove("ps-open");
    }
    entry.addEventListener("click", open);
    sheet.addEventListener("click", function (e) {
      if (e.target.closest("[data-ps-close]")) close();
    });
    // 저장하면 볼일이 끝난다 — app.js 의 저장 처리가 돈 뒤에 닫는다
    var save = doc.getElementById("pfSave");
    if (save) save.addEventListener("click", function () { setTimeout(close, 60); });

    window.PetSheet = { open: open, close: close };
    if (window.Icon && window.Icon.hydrate) window.Icon.hydrate(sec);
    if (window.Icon && window.Icon.hydrate) window.Icon.hydrate(sheet);
  }

  /* ══════════ 2. 오프라인 띠 · 토스트 ══════════ */

  /* ⚠️ 오프라인 띠는 2026-08-17 제거했다.
   *
   * 실기기 「연결 진단」에서 5개 항목이 전부 HTTP 200(카카오 SDK 포함)인데도 띠가 떠서
   * 화면 아래 버튼을 가렸다. 즉 이 띠는 안 되는 것을 알려 주기는커녕, 되는 상태에서
   * 오해를 만들고 조작까지 방해했다. 판정이 틀리는 지표는 없느니만 못하다.
   *
   * 연결이 진짜 안 되면 화면에 데이터가 안 나오는 것으로 이미 드러나고,
   * 원인 확인은 콘솔에서 `PetDiag()` 로 언제든 열 수 있다(진단 화면은 그대로 살아 있다).
   * 다시 띄우려면 아래 주석을 풀고 watchNetwork 의 paint 를 되살리면 된다. */
  function buildChrome() {
    var toast = doc.createElement("div");
    toast.className = "app-toast";
    toast.id = "appToast";
    doc.body.appendChild(toast);
  }

  var toastTimer = null;
  function toast(msg, ms) {
    var el = doc.getElementById("appToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, ms || 2000);
  }

  /* navigator.onLine 은 안드로이드 WebView 에서 믿을 수 없다.
   *
   * ① ACCESS_NETWORK_STATE 권한이 없으면 크로미움이 연결 종류를 알아내지 못해
   *    항상 false 로 고정된다. 2026-08-15 실측 — 와이파이가 멀쩡한 기기에서
   *    오프라인 띠가 계속 떠 있던 원인이 이것이었다(매니페스트에 권한 추가로 해결).
   * ② 권한이 있어도 "연결됨"이 "우리 서버에 닿는다"는 뜻은 아니다.
   *    카페 와이파이 로그인 페이지(캡티브 포털)·사내망 차단이 흔하다.
   *
   * → 그래서 브라우저 말을 믿지 않고 API 를 실제로 한 번 찔러 본 결과로만
   *   띠를 띄운다. 실패했을 때만 뜨고, 뜨면 원인을 볼 수 있는 「진단」이 붙는다. */

  var PROBE_PATH = "/api/pettour?numOfRows=1&pageNo=1";
  var netTimer = null;
  var lastNetOk = null;

  /** 서버에 실제로 닿는지 확인 — {ok, detail} */
  function probe(ms) {
    var url = (CFG.API_BASE || "") + PROBE_PATH + "&_probe=" + Date.now();
    var t0 = Date.now();
    return fetchTimeout(url, { cache: "no-store" }, ms || 8000).then(function (res) {
      return { ok: res.ok, detail: "HTTP " + res.status + " · " + (Date.now() - t0) + "ms" };
    }, function (err) {
      return { ok: false, detail: describeErr(err) + " · " + (Date.now() - t0) + "ms" };
    });
  }

  /** 띠는 없앴지만 상태 자체는 계속 확인해 둔다 — PetDiag·PetNet 이 참조한다 */
  function watchNetwork() {
    var el = null;                 // 띠 제거됨(위 buildChrome 주석 참고)
    var msg = null;

    /* 한 번 실패했다고 바로 띠를 띄우지 않는다.
     * 지하철·엘리베이터처럼 잠깐 끊기는 순간이나 서버가 한 번 늦게 답한 것까지
     * "연결 실패"로 보이면, 정작 멀쩡한 상태에서도 배너가 계속 뜬 것처럼 느껴진다.
     * 연속 2회 실패해야 띄우고, 한 번이라도 성공하면 즉시 내린다. */
    var failStreak = 0;

    function paint(ok, detail) {
      lastNetOk = ok;
      if (!el) return;
      failStreak = ok ? 0 : failStreak + 1;
      el.classList.toggle("show", failStreak >= 2);
      if (!ok && msg) {
        msg.textContent = navigator.onLine === false && detail && /네트워크|시간 초과/.test(detail)
          ? "인터넷에 연결되어 있지 않습니다 — 저장된 정보만 보여요"
          : "서버에 연결하지 못했습니다 — 저장된 정보만 보여요";
      }
      // 실패 중일 때만 다시 확인한다(성공했으면 조용히 있는다).
      // 첫 실패는 3초 뒤 곧바로 재확인 — 진짜 끊겼다면 늦지 않게 알려야 하고,
      // 순간적인 것이었다면 그 사이 조용히 회복된다.
      clearTimeout(netTimer);
      if (!ok) netTimer = setTimeout(check, failStreak === 1 ? 3000 : 15000);
    }

    function check() { probe().then(function (r) { paint(r.ok, r.detail); }); }

    check();
    // 이벤트는 힌트로만 쓴다 — 이벤트가 와도 최종 판단은 항상 실제 요청으로 한다
    window.addEventListener("online", check, { passive: true });
    window.addEventListener("offline", check, { passive: true });
    doc.addEventListener("visibilitychange", function () {
      if (!doc.hidden) check();          // 지하철에서 나와 앱을 다시 열었을 때
    }, { passive: true });
    window.PetNet = { check: check, probe: probe, isOk: function () { return lastNetOk; } };
  }

  /* ══════════ 3. 안드로이드 뒤로가기 ══════════ */

  /** 지금 열려 있는 것 중 "뒤로"로 닫아야 할 것을 찾아 닫는다 */
  function closeTopLayer() {
    // 열려 있는 모달·팝오버·상세 패널을 화면 위쪽 것부터 닫는다
    var candidates = [
      { sel: "#appDiag.show",              close: "#diagClose" },
      { sel: "#petSheet.show",             close: "#petSheetClose" },
      { sel: "#aiModal:not(.hidden)",      close: "#aiClose" },
      { sel: "#regionPop:not(.hidden)",    close: "#regionPopClose" },
      { sel: "#detailPanel:not(.hidden)",  close: "#detailClose" }
    ];
    for (var i = 0; i < candidates.length; i++) {
      var host = doc.querySelector(candidates[i].sel);
      if (!host) continue;
      var btn = doc.querySelector(candidates[i].close);
      if (btn) { btn.click(); return true; }
      host.classList.add("hidden");
      return true;
    }
    return false;
  }

  var lastBackAt = 0;
  function onBack() {
    // ① 위에 덮인 레이어부터
    if (closeTopLayer()) return;

    // ② 홈이 아니면 홈으로 (히스토리가 꼬여도 항상 예측 가능한 곳으로 간다)
    var App = window.PetApp;
    var page = doc.querySelector(".app-tabbar .tab.active");
    var cur = page ? page.dataset.page : "home";
    if (cur !== "home") {
      if (App && App.showPage) App.showPage("home");
      else history.back();
      return;
    }

    // ③ 홈에서 두 번 연속 = 종료
    var now = Date.now();
    if (now - lastBackAt < 2000) {
      call(AppPlugin, "exitApp");
      return;
    }
    lastBackAt = now;
    toast("한 번 더 누르면 종료됩니다");
  }

  function bindBackButton() {
    if (AppPlugin && AppPlugin.addListener) {
      AppPlugin.addListener("backButton", onBack);
    }
  }

  /* ══════════ 4. 상태바 · 스플래시 ══════════ */

  /* 플러그인 호출은 프로미스를 돌려준다. 실패하면 try/catch 로는 안 잡히고
   * unhandled rejection 으로 콘솔에 남으므로(웹 QA 모드에서 "not implemented on web"),
   * 반드시 이 헬퍼를 통해 부른다. */
  function call(obj, method, arg) {
    if (!obj || typeof obj[method] !== "function") return;
    try {
      var p = obj[method](arg);
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (_) {}
  }

  function hideSplash() {
    call(SplashPlugin, "hide");
  }

  function setupNativeChrome() {
    // 배경이 흰색이므로 상태바 글자·아이콘은 어둡게
    call(StatusPlugin, "setStyle", { style: "LIGHT" });   // LIGHT = 밝은 배경용(어두운 글자)
    call(StatusPlugin, "setBackgroundColor", { color: "#FFFFFF" });

    /* 스플래시 내리기.
     * capacitor.config.json 의 launchAutoHide 가 진짜 안전장치이고, 여기서는
     * 첫 화면이 그려지자마자 더 빨리 닫아 준다. 어떤 이유로든 이 코드가 실패해도
     * 네이티브가 알아서 닫으므로 로고에서 멈추는 일은 없다. */
    if (doc.readyState === "complete") setTimeout(hideSplash, 200);
    else window.addEventListener("load", function () { setTimeout(hideSplash, 200); });
    // 위 load 이벤트가 영영 안 오는 경우(자산 하나가 끝없이 대기)에도 닫는다
    setTimeout(hideSplash, 3000);
  }

  /* ══════════ 5. 바깥으로 나가는 링크 ══════════ */

  /* 카카오맵 길안내 같은 링크는 WebView 안에서 열리면 앱이 통째로 그 페이지가
   * 되어 버린다. Capacitor 는 target="_blank" 를 시스템(설치돼 있으면 카카오맵
   * 앱)으로 넘겨주므로, 혹시 빠져 있는 링크에 target 을 채워 준다. */
  function guardExternalLinks() {
    doc.addEventListener("click", function (e) {
      var a = e.target && e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (!/^https?:\/\//i.test(href)) return;             // 내부 이동은 그대로
      if (href.indexOf(location.origin) === 0) return;     // 우리 자산이면 그대로
      if (a.target !== "_blank") a.target = "_blank";
      a.rel = "noopener";
    }, true);
  }

  /* ══════════ 6. 연결 진단 ══════════
   *
   * "인터넷이 안 돼요" 는 원인이 열 가지다 — 기기가 정말 끊겼거나, 서버가
   * 죽었거나, CORS 가 막혔거나, 특정 기능 하나만 고장났거나. 기기에서 직접
   * 확인할 방법이 없으면 추측만 오간다. 이 화면은 각 기능을 실제로 한 번씩
   * 호출해 보고 결과를 그대로 보여 준다. 「결과 복사」로 통째로 붙여넣으면
   * 어디가 막혔는지 바로 안다. */

  var CHECKS = [
    { name: "장소 데이터 (관광공사)", path: "/api/pettour?numOfRows=1&pageNo=1" },
    { name: "AI 도우미 (제미나이)",   path: "/api/ai", post: { q: "연결 확인", mode: "search" } },
    // 파라미터 이름을 틀리면 400 이 떠서 "서버 이상"처럼 보인다 — 실제 호출부와 같은 이름을 쓴다
    { name: "장소 상세 (네이버)",     path: "/api/place?q=%EC%84%9C%EC%9A%B8%EC%88%B2" },
    { name: "부가 정보 (동물병원)",   path: "/api/extra?src=vet&numOfRows=1&pageNo=1" }
  ];

  function runCheck(c) {
    var url = (CFG.API_BASE || "") + c.path + (c.path.indexOf("?") < 0 ? "?" : "&") + "_diag=" + Date.now();
    var init = { cache: "no-store" };
    if (c.post) {
      init.method = "POST";
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(c.post);
    }
    var t0 = Date.now();
    return fetchTimeout(url, init, 15000).then(function (res) {
      /* 4xx 라도 "서버까지 갔다"는 뜻이다 — 인터넷 문제와 기능 문제를 갈라 준다.
       * 그래서 도달 여부(ok)와 응답 상태를 나눠서 표시한다. */
      return { ok: true, good: res.ok, text: "HTTP " + res.status + " · " + (Date.now() - t0) + "ms" };
    }, function (err) {
      return { ok: false, good: false, text: describeErr(err) + " · " + (Date.now() - t0) + "ms" };
    });
  }

  /** 카카오맵 SDK 가 이 앱 주소에서 실제로 로드되는지.
   *
   * fetch 로는 판별할 수 없다 — dapi.kakao.com 은 CORS 헤더를 주지 않아서
   * no-cors 로 받으면 불투명 응답이라 401 과 200 이 구별되지 않는다.
   * 카카오는 등록되지 않은 도메인에 401 을 주고, 그때 <script> 는 onerror 를
   * 낸다. 지도 코드가 겪는 것과 똑같은 방식으로 확인해야 결과가 정확하다. */
  function checkKakao(url) {
    var t0 = Date.now();
    return new Promise(function (res) {
      var s = doc.createElement("script");
      var done = false;
      var finish = function (r) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        s.remove();
        res(r);
      };
      var timer = setTimeout(function () {
        finish({ ok: false, good: false, text: "시간 초과 · " + (Date.now() - t0) + "ms" });
      }, 10000);
      s.src = url;
      s.onload = function () {
        finish({ ok: true, good: true, text: "정상 · " + (Date.now() - t0) + "ms" });
      };
      s.onerror = function () {
        // 스크립트는 오류 사유를 알려주지 않는다. 카카오에서 이 상황은 사실상 도메인 미등록이다.
        finish({
          ok: true, good: false,
          text: "차단됨 — 카카오 콘솔에 이 앱 주소(" + location.origin + ")가 등록되지 않았습니다. "
              + "지도는 오픈맵으로 대체됩니다. · " + (Date.now() - t0) + "ms"
        });
      };
      doc.head.appendChild(s);
    });
  }

  function diagRow(label, state, text) {
    var mark = state === "ok" ? "✅" : state === "warn" ? "⚠️" : state === "run" ? "⏳" : "❌";
    return '<div class="diag-row"><b>' + mark + " " + label + "</b><span>" + text + "</span></div>";
  }

  var diagText = "";

  function openDiag() {
    var wrap = doc.getElementById("appDiag");
    if (!wrap) {
      wrap = doc.createElement("div");
      wrap.className = "app-diag";
      wrap.id = "appDiag";
      wrap.innerHTML =
        '<div class="diag-sheet">'
        + '<header><b>연결 진단</b><button type="button" id="diagClose" aria-label="닫기">✕</button></header>'
        + '<div class="diag-body" id="diagBody"></div>'
        + '<footer><button type="button" class="diag-copy" id="diagCopy">결과 복사</button>'
        + '<button type="button" class="diag-again" id="diagAgain">다시 검사</button></footer>'
        + "</div>";
      doc.body.appendChild(wrap);
      wrap.addEventListener("click", function (e) { if (e.target === wrap) closeDiag(); });
      wrap.querySelector("#diagClose").addEventListener("click", closeDiag);
      wrap.querySelector("#diagAgain").addEventListener("click", runDiag);
      wrap.querySelector("#diagCopy").addEventListener("click", copyDiag);
    }
    wrap.classList.add("show");
    runDiag();
  }

  function closeDiag() {
    var wrap = doc.getElementById("appDiag");
    if (wrap) wrap.classList.remove("show");
  }

  function runDiag() {
    var body = doc.getElementById("diagBody");
    if (!body) return;
    body.innerHTML = diagRow("검사 중…", "run", "잠시만요");

    var env = [
      ["앱 주소(오리진)", location.origin],
      ["API 서버", CFG.SERVER_ORIGIN || "(상대경로)"],
      ["기기 연결 표시", String(navigator.onLine) + (navigator.onLine ? "" : " ← 이 값은 틀릴 수 있음")],
      ["앱 버전", (CFG.APP_NAME || "app")]
    ];

    var jobs = CHECKS.map(runCheck);
    jobs.push(checkKakao("https://dapi.kakao.com/v2/maps/sdk.js?appkey="
      + ((CFG.KAKAO_JS_KEYS || [])[0] || "") + "&autoload=false"));

    Promise.all(jobs).then(function (rs) {
      var names = CHECKS.map(function (c) { return c.name; }).concat(["카카오맵 SDK"]);
      var html = "", plain = "[같이가개 연결 진단]\n";

      env.forEach(function (e) {
        html += '<div class="diag-env"><b>' + e[0] + "</b><span>" + e[1] + "</span></div>";
        plain += e[0] + ": " + e[1] + "\n";
      });
      html += '<div class="diag-sep"></div>';
      plain += "\n";

      var reached = 0;
      rs.forEach(function (r, i) {
        if (r.ok) reached++;
        html += diagRow(names[i], r.good ? "ok" : r.ok ? "warn" : "bad", r.text);
        plain += (r.good ? "OK   " : r.ok ? "WARN " : "FAIL ") + names[i] + ": " + r.text + "\n";
      });

      /* 「닿았는가(ok)」와 「제대로 응답했는가(good)」는 다르다.
       * 카카오맵 도메인 미등록처럼 서버에는 닿지만 거부당하는 경우가 있어,
       * 둘을 합쳐서 판정하지 않으면 "정상"이라고 잘못 말하게 된다. */
      var allGood = rs.every(function (r) { return r.good; });
      var verdict = reached === 0
        ? "❌ 인터넷 자체가 막혀 있습니다. 와이파이/데이터를 확인하거나, 휴대폰 설정 → 앱 → 같이가개 → 모바일 데이터 사용 허용을 켜 주세요."
        : reached < rs.length
          ? "⚠️ 일부 기능이 서버에 닿지 못합니다. 위의 ❌ 항목을 알려 주세요."
          : allGood
            ? "✅ 모든 연결이 정상입니다."
            : "⚠️ 인터넷은 되지만 일부 기능이 거부되었습니다. 위의 ⚠️ 항목 설명을 확인해 주세요.";
      html += '<div class="diag-verdict">' + verdict + "</div>";
      plain += "\n" + verdict + "\n";

      diagText = plain;
      body.innerHTML = html;
      // 진단을 돌린 김에 하단 띠도 최신 상태로 맞춘다
      if (window.PetNet && window.PetNet.check) window.PetNet.check();
    });
  }

  function copyDiag() {
    var done = function () { toast("진단 결과를 복사했습니다"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(diagText).then(done, fallback);
    } else fallback();

    function fallback() {
      // WebView 에서 clipboard API 가 막혀 있을 때
      var ta = doc.createElement("textarea");
      ta.value = diagText;
      ta.style.cssText = "position:fixed;top:-1000px";
      doc.body.appendChild(ta);
      ta.select();
      try { doc.execCommand("copy"); done(); } catch (_) { toast("복사에 실패했습니다"); }
      doc.body.removeChild(ta);
    }
  }

  /* ══════════ 부팅 ══════════ */

  function boot() {
    /* 한 조각이 실패해도 나머지는 살아 있어야 한다. 특히 스플래시 닫기는
     * 앞 단계가 터졌다고 같이 죽으면 앱이 로고에서 멈춘 것처럼 보인다. */
    var steps = [
      ["탭바", buildTabbar],
      ["히어로 그림", swapHeroArt],
      ["배너 문구", buildHeroCopy],
      ["반려동물 시트", buildPetSheet],
      ["보조 UI", buildChrome],
      ["네트워크 감시", watchNetwork],
      ["뒤로가기", bindBackButton],
      ["상태바·스플래시", setupNativeChrome],
      ["외부 링크", guardExternalLinks]
    ];
    // 띠가 안 떠 있을 때도 진단을 열 수 있어야 한다(문의 대응용)
    window.PetDiag = openDiag;
    for (var i = 0; i < steps.length; i++) {
      try {
        steps[i][1]();
      } catch (e) {
        if (window.console) console.error("[appshell] " + steps[i][0] + " 초기화 실패:", e);
      }
    }
  }

  /* app.js 는 DOMContentLoaded 를 기다리지 않고 스크립트 실행 시점에 바로
   * init() → bindEvents() 를 돌린다. 이 파일이 app.js 보다 먼저(그리고 body 끝에서)
   * 실행되므로, 여기서도 기다리지 말고 즉시 탭바를 심어야 클릭이 배선된다. */
  boot();
})();
