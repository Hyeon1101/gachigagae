/* ─────────────────────────────────────────────────────────────
 * ❤️ 즐겨찾기 + 🔐 구글 로그인(선택)
 *
 * 설계 원칙 세 가지
 *
 *  1) 서버 저장소가 없어도 완전히 동작한다.
 *     즐겨찾기는 장소의 "복사본"을 통째로 localStorage 에 넣는다. 그래서 다음
 *     방문에 공공데이터 API가 죽어 있어도 저장한 곳은 그대로 뜨고 길안내도 된다.
 *     (DB·Netlify Blobs·Functions 어느 것도 쓰지 않는다)
 *
 *  2) 로그인은 어디까지나 선택이다.
 *     비로그인(게스트)도 즐겨찾기를 포함한 모든 기능을 100% 쓴다. 로그인의 효과는
 *     단 하나 — 저장 칸이 계정별로 나뉜다. 구글 클라이언트 ID를 넣지 않으면
 *     로그인 UI 자체가 나타나지 않고, 나머지는 아무 영향 없이 돌아간다.
 *
 *  3) 계정별 기록은 "칸을 나누는" 방식이다.
 *     petmap_fav_v1__guest        ← 로그인 안 한 상태
 *     petmap_fav_v1__g_<구글 sub> ← 그 구글 계정으로 로그인한 상태
 *     로그아웃하면 게스트 칸으로 돌아가고, 다시 로그인하면 그 계정 칸이 되살아난다.
 *     기기를 바꾸면 따라오지 않는다(서버가 없으므로) — 대신 아무 데이터도
 *     우리 서버에 남지 않는다.
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var FAV_PREFIX = "petmap_fav_v1__";
  var ACC_KEY = "petmap_account_v1";
  var MAX_FAV = 300;                       // localStorage 용량 보호

  var T = function (k, v) { return window.T ? window.T(k, v) : k; };

  /* ══════════ 저장소 도우미 (사파리 프라이빗 모드 등에서 던지는 예외를 삼킨다) ══════════ */
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (_) {} }
  };
  function readJSON(k, dflt) {
    var raw = LS.get(k);
    if (!raw) return dflt;
    try { var v = JSON.parse(raw); return v == null ? dflt : v; } catch (_) { return dflt; }
  }

  /* ══════════ 🔐 계정 ══════════ */

  var user = readJSON(ACC_KEY, null);      // { sub, name, email, picture } | null
  var accListeners = [];

  function clientId() {
    var c = window.PETMAP_CONFIG || {};
    return (c.GOOGLE_CLIENT_ID || "").trim();
  }

  /* ── 앱에서는 구글의 웹 로그인(GIS)이 아예 뜨지 않는다 ─────────────
   * 구글은 삽입형 웹뷰 안에서의 OAuth 로그인을 정책으로 막아 둔다. 그래서
   * accounts.google.com/gsi/client 버튼은 웹사이트에서만 그려지고, 앱에서는
   * 자리만 비어 있었다(2026-08-18 v1.4 에서 확인 — [로그인 없이 사용하기]만 남음).
   * 앱에서는 기기에 설치된 구글 플레이 서비스에게 로그인을 맡긴다(네이티브 플러그인).
   * ───────────────────────────────────────────────────────────── */
  var native = (function () {
    var C = window.Capacitor;
    var isNative = !!(C && (typeof C.isNativePlatform === "function" ? C.isNativePlatform() : C.isNative));
    if (!isNative) return null;
    if (typeof C.isPluginAvailable === "function" && !C.isPluginAvailable("GoogleAuth")) return null;
    try {
      var reg = window.capacitorExports && window.capacitorExports.registerPlugin;
      return reg ? reg("GoogleAuth") : (C.Plugins && C.Plugins.GoogleAuth) || null;
    } catch (_) { return null; }
  })();

  /* 로그인을 보여 줄 수 있는 상태인가 — 앱은 플러그인이, 웹은 클라이언트 ID가 있어야 한다.
   * 앱에서는 클라이언트 ID 가 비어 있어도 기본 로그인으로 계정 구분이 되므로 막지 않는다. */
  var loginEnabled = function () { return native ? true : !!clientId(); };

  /** 네이티브 로그인 결과 → 우리 계정 모양으로 */
  function adoptNative(acc) {
    if (!acc || (!acc.id && !acc.idToken)) throw new Error("empty");
    var claims = acc.idToken ? decodeJwt(acc.idToken) : null;
    setUser({
      sub: String((claims && claims.sub) || acc.id),
      name: acc.name || (claims && claims.name) || acc.email || "",
      email: acc.email || (claims && claims.email) || "",
      picture: acc.picture || (claims && claims.picture) || ""
    });
    toast(T("acc.signedIn", { name: user.name || T("acc.guest") }));
  }

  /** 구글이 준 ID 토큰(JWT)의 payload 를 읽는다.
   *  서명 검증은 하지 않는다 — 서버가 없고, 이 값으로 보호되는 자원도 없다.
   *  용도는 "저장 칸 이름표"와 화면에 띄울 이름·사진뿐이다. */
  function decodeJwt(token) {
    try {
      var p = String(token).split(".")[1];
      if (!p) return null;
      var b64 = p.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      // atob 는 바이트를 주므로 한글 이름이 깨지지 않게 UTF-8 로 되돌린다
      var json = decodeURIComponent(atob(b64).split("").map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(""));
      return JSON.parse(json);
    } catch (_) { return null; }
  }

  function setUser(u) {
    user = u;
    invalidate();                           // 저장 칸이 통째로 바뀐다
    if (u) LS.set(ACC_KEY, JSON.stringify(u));
    else LS.del(ACC_KEY);
    accListeners.forEach(function (f) { try { f(u); } catch (_) {} });
    emitFav();                              // 저장 칸이 통째로 바뀌었다
  }

  function onCredential(resp) {
    var claims = resp && resp.credential ? decodeJwt(resp.credential) : null;
    if (!claims || !claims.sub) { toast(T("acc.failed")); return; }
    setUser({
      sub: String(claims.sub),
      name: claims.name || claims.given_name || claims.email || "",
      email: claims.email || "",
      picture: claims.picture || ""
    });
    toast(T("acc.signedIn", { name: user.name || T("acc.guest") }));
  }

  /* GIS 스크립트는 로그인을 쓸 때만 불러온다 — 안 쓰면 네트워크 요청조차 없다 */
  var gisReady = null;
  function loadGIS() {
    if (!loginEnabled()) return Promise.reject(new Error("no client id"));
    if (gisReady) return gisReady;
    gisReady = new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
      var s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = function () {
        if (window.google && window.google.accounts && window.google.accounts.id) resolve();
        else reject(new Error("gsi load"));
      };
      s.onerror = function () { reject(new Error("gsi network")); };
      document.head.appendChild(s);
    }).then(function () {
      window.google.accounts.id.initialize({
        client_id: clientId(),
        callback: onCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
        // 팝업/리다이렉트가 아닌 표준 버튼 흐름만 쓴다(백엔드 불필요)
        ux_mode: "popup"
      });
    });
    return gisReady;
  }

  /* 구글 브랜딩 규격에 맞춘 버튼 — 흰 바탕, 회색 테두리, 4색 G 로고.
   * 웹에서는 구글이 직접 그려 주지만(renderButton), 앱에서는 그 스크립트가
   * 돌지 않으므로 규격대로 우리가 그린다(색·비율·문구 모두 가이드라인 값). */
  var G_LOGO =
    '<svg class="g-mark" viewBox="0 0 48 48" aria-hidden="true">' +
      '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
      '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
      '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
      '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
    "</svg>";

  /** 앱 전용 — 눌렀을 때 기기의 구글 계정 선택 화면을 연다 */
  function mountNativeButton(host) {
    host.innerHTML =
      '<button type="button" class="g-btn">' + G_LOGO +
        "<span>" + esc(T("acc.signIn")) + "</span></button>";

    var btn = host.querySelector("button");
    btn.addEventListener("click", function () {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.classList.add("is-busy");
      native.signIn({ clientId: clientId() })
        .then(adoptNative)
        .catch(function (err) {
          var code = String((err && (err.code || err.message)) || "");
          // 사용자가 계정 선택 화면을 그냥 닫은 것은 실패가 아니다 — 조용히 넘어간다
          if (/cancel/i.test(code) || code === "12501") return;
          if (/unavailable/i.test(code)) { toast(T("acc.blocked")); return; }
          toast(/network/i.test(code) ? T("acc.noNet") : T("acc.failed"));
        })
        .then(function () {
          btn.disabled = false;
          btn.classList.remove("is-busy");
        });
    });
  }

  /** 구글 공식 버튼을 그린다 — 브랜딩 규정상 우리가 흉내 내지 않고 진짜를 심는다 */
  function mountGoogleButton(host) {
    if (!host || !loginEnabled()) return;
    if (native) { mountNativeButton(host); return; }
    loadGIS().then(function () {
      host.innerHTML = "";
      window.google.accounts.id.renderButton(host, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
        locale: window.I18N && window.I18N.isEn() ? "en" : "ko",
        width: 240
      });
    }).catch(function () {
      /* 스크립트가 막혔을 때 — 로그인만 조용히 빠지고 나머지는 그대로.
       * 바로 윗줄에 이미 acc.optional 안내가 있으므로 같은 문장을 또 쓰지 않는다
       * (v1.4 에서 같은 안내가 두 번 겹쳐 보였다). */
      host.innerHTML = '<span class="fav-note">' + esc(T("acc.blocked")) + "</span>";
    });
  }

  function signOut() {
    try {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch (_) {}
    // 앱에서는 기기 쪽 세션도 끊어야 다음에 계정 선택 화면이 다시 뜬다
    if (native) { try { native.signOut(); } catch (_) {} }
    setUser(null);
    toast(T("acc.signedOut"));
  }

  /* ══════════ ❤️ 즐겨찾기 ══════════ */

  function favKey() { return FAV_PREFIX + (user && user.sub ? "g_" + user.sub : "guest"); }

  var favListeners = [];
  function emitFav() {
    paintAll();
    renderPanel();
    favListeners.forEach(function (f) { try { f(list()); } catch (_) {} });
  }

  /* 메모리 캐시 — list() 는 하트를 칠할 때마다 불린다. 매번 localStorage 를 읽고
   * JSON.parse 하면 카드가 60장일 때 한 번의 렌더에서만 수십 번 파싱하게 된다.
   * 쓰기(save)·계정 전환에서만 무효화하면 되므로 캐시가 어긋날 일이 없다. */
  var cache = null;         // { key: 저장칸, arr: [], ids: {} }
  function invalidate() { cache = null; }

  function snap() {
    var k = favKey();
    if (cache && cache.key === k) return cache;
    var arr = readJSON(k, []);
    if (!Array.isArray(arr)) arr = [];
    var ids = {};
    arr.forEach(function (x) { ids[String(x.id)] = true; });
    cache = { key: k, arr: arr, ids: ids };
    return cache;
  }

  function list() { return snap().arr; }
  function save(arr) {
    LS.set(favKey(), JSON.stringify(arr.slice(0, MAX_FAV)));
    invalidate();
  }
  function has(id) { return !!snap().ids[String(id)]; }

  /** 저장할 복사본 — 다시 열고 길안내하는 데 필요한 것만, 캐시성 필드는 뺀다 */
  function snapshot(p) {
    var out = {};
    Object.keys(p).forEach(function (k) {
      // _v/_vVer = 판정 메모이제이션, _naver* = 평점 캐시 → 저장할 이유가 없다
      if (k === "_v" || k === "_vVer" || k.indexOf("_naver") === 0) return;
      var v = p[k];
      if (typeof v === "function" || typeof v === "undefined") return;
      out[k] = v;
    });
    out._savedAt = Date.now();
    return out;
  }

  function add(place) {
    if (!place || place.id == null) return false;
    var arr = list().filter(function (x) { return String(x.id) !== String(place.id); });
    arr.unshift(snapshot(place));           // 최근 저장이 위로
    save(arr);
    emitFav();
    return true;
  }
  function remove(id) {
    id = String(id);
    save(list().filter(function (x) { return String(x.id) !== id; }));
    emitFav();
  }
  /** 로그인해야 즐겨찾기를 쓸 수 있다(사용자 지정).
   *  로그인 UI 자체가 없는 상태(클라이언트 ID 미설정)에서까지 막으면 아무도 못 쓰므로,
   *  그때는 예전처럼 게스트로 열어 둔다 — 잠글 수 있을 때만 잠근다. */
  function canSave() { return !!user || !loginEnabled(); }

  function requireLogin() {
    toast(T("fav.needLogin"));
    togglePanel(true);          // 패널을 열어 구글 로그인 버튼을 바로 보여 준다
  }

  function toggle(place) {
    if (!place || place.id == null) return false;
    if (!canSave()) { requireLogin(); return false; }
    if (has(place.id)) { remove(place.id); toast(T("fav.removed")); return false; }
    add(place); toast(T("fav.added"));
    return true;
  }
  function clear() {
    save([]);
    emitFav();
  }

  /* ══════════ 화면 ══════════ */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toast(msg) {
    // 앱에는 셸이 만든 토스트가 이미 있다(하단 탭바 위로 뜬다) → 그대로 재사용.
    // 웹에는 없으므로 같은 역할의 얇은 띠를 한 번만 만들어 둔다.
    var el = document.getElementById("appToast") || document.getElementById("favToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "favToast";
      el.className = "fav-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }

  /** 문서 안의 모든 하트를 현재 저장 상태에 맞춘다 (목록·상세가 다시 그려질 때마다)
   *
   *  ⚠️ 여기서 DOM 을 건드리면 그 변경이 다시 MutationObserver 를 깨우고, 그 관찰자가
   *  또 paintAll 을 부른다. 예전 코드는 상태가 그대로여도 매번 innerHTML 을 새로 써서
   *  이 고리가 끊기지 않았다(실측: 카드 5장짜리 목록에서 **초당 941건**의 DOM 변경이
   *  영원히 계속됨 → 클릭이 씹히고 화면 전체가 느려짐).
   *
   *  그래서 **바뀐 하트만** 손댄다. 상태가 같으면 DOM 을 한 글자도 건드리지 않으므로
   *  변경 알림이 생기지 않고 고리가 저절로 멈춘다. */
  function paintAll(root) {
    var ids = snap().ids;
    var addLbl = T("fav.add"), delLbl = T("fav.remove");
    var lang = window.I18N && window.I18N.isEn && window.I18N.isEn() ? "en" : "ko";
    var icon = window.Icon || function () { return ""; };

    (root || document).querySelectorAll("[data-fav]").forEach(function (b) {
      var on = !!ids[String(b.getAttribute("data-fav"))];
      // 이미 이 상태로 칠해져 있으면 건너뛴다 (언어가 바뀌면 라벨을 다시 써야 하므로 같이 본다)
      var mark = (on ? "1" : "0") + lang;
      if (b.dataset.favPaint === mark) return;
      b.dataset.favPaint = mark;

      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.setAttribute("title", on ? delLbl : addLbl);
      b.setAttribute("aria-label", on ? delLbl : addLbl);
      b.innerHTML = on ? icon("heartOn") : icon("heart");
    });

    var badge = document.getElementById("favCount");
    if (badge) {
      var n = snap().arr.length;
      var txt = n > 99 ? "99+" : String(n);
      if (badge.textContent !== txt) badge.textContent = txt;
      badge.classList.toggle("hidden", n === 0);
    }
  }

  function accountRowHtml() {
    if (user) {
      var pic = user.picture
        ? '<img class="fav-ava" src="' + esc(user.picture) + '" alt="" referrerpolicy="no-referrer">'
        : '<span class="fav-ava fav-ava-blank">' + esc((user.name || "?").slice(0, 1)) + "</span>";
      return '<div class="fav-acc">' + pic +
        '<div class="fav-acc-txt"><b>' + esc(user.name || T("acc.guest")) + "</b>" +
        '<span>' + esc(T("fav.userNote", { name: user.name || "" })) + "</span></div>" +
        '<button type="button" class="btn btn-ghost btn-sm" id="favSignOut">' + esc(T("acc.signOut")) + "</button></div>";
    }
    if (!loginEnabled()) {
      // 클라이언트 ID 미설정 — 로그인 UI를 아예 감춘다(기능은 전부 그대로)
      return '<div class="fav-acc fav-acc-guest"><span class="fav-note">' + esc(T("fav.guestNote")) + "</span></div>";
    }
    return '<div class="fav-acc fav-acc-guest">' +
      '<div class="fav-acc-txt"><b>' + esc(T("acc.guest")) + "</b><span>" + esc(T("acc.optional")) + "</span></div>" +
      '<div id="favGsi" class="fav-gsi"></div></div>';
  }

  function renderPanel() {
    var pop = document.getElementById("favPop");
    if (!pop || pop.classList.contains("hidden")) return;
    var items = list();
    var body = document.getElementById("favBody");
    if (!body) return;

    body.innerHTML = accountRowHtml() +
      (!canSave()
        ? '<div class="fav-empty">' + T("fav.loginEmpty") + "</div>"
        : items.length
        ? '<button type="button" class="btn btn-ghost btn-sm fav-toList" id="favToList">' +
            esc(T("fav.openList")) + "</button>" +
          '<div class="fav-list">' + items.map(function (p) {
            var emoji = "🐾";
            return '<div class="fav-item" data-fav-id="' + esc(p.id) + '">' +
              '<div class="fav-thumb">' + (p.img
                ? '<img src="' + esc(p.img) + '" alt="" loading="lazy" data-imgfail="remove">'
                : esc(emoji)) + "</div>" +
              '<div class="fav-main">' +
                '<div class="fav-name">' + esc(p.title) + "</div>" +
                '<div class="fav-addr">' + esc(p.addr || "") + "</div>" +
              "</div>" +
              '<div class="fav-acts">' +
                '<button type="button" class="btn btn-ghost btn-sm" data-fav-open="' + esc(p.id) + '">' + esc(T("fav.open")) + "</button>" +
                '<a class="btn btn-primary btn-sm fav-route" target="_blank" rel="noopener" ' +
                   'href="' + esc(routeUrl(p)) + '">' + esc(T("fav.route")) + "</a>" +
                '<button type="button" class="fav-x" data-fav-del="' + esc(p.id) + '" title="' + esc(T("fav.remove")) + '">' + window.Icon("close") + "</button>" +
              "</div></div>";
          }).join("") + "</div>" +
          '<button type="button" class="btn btn-ghost btn-sm fav-clear" id="favClear">' + esc(T("fav.clear")) + "</button>"
        : '<div class="fav-empty">' + T("fav.empty") + "</div>");

    var cnt = document.getElementById("favPopCount");
    if (cnt) cnt.textContent = T("fav.count", { n: items.length });

    if (!user && loginEnabled()) mountGoogleButton(document.getElementById("favGsi"));
    if (window.Icon && window.Icon.hydrate) window.Icon.hydrate(body);
  }

  function routeUrl(p) {
    if (window.PetAI && window.PetAI.Route) return window.PetAI.Route.kakao(p);
    return "https://map.kakao.com/link/search/" + encodeURIComponent((p.title || "") + " " + (p.addr || ""));
  }

  function togglePanel(force) {
    var pop = document.getElementById("favPop");
    var btn = document.getElementById("favBtn");
    if (!pop) return;
    var show = typeof force === "boolean" ? force : pop.classList.contains("hidden");
    pop.classList.toggle("hidden", !show);
    if (btn) btn.setAttribute("aria-expanded", show ? "true" : "false");
    if (show) {
      var rp = document.getElementById("regionPop");     // 두 팝오버가 겹치지 않게
      if (rp) rp.classList.add("hidden");
      renderPanel();
    }
  }

  /* ══════════ 배선 ══════════ */

  function bind() {
    /* 하트 토글 — 캡처 단계에서 잡는다.
     * 버블 단계로 두면 카드(.place-card)의 클릭 처리가 먼저 끝나 버려서
     * stopPropagation 이 상세 패널 열림을 막지 못한다. 캡처는 문서→카드→버튼
     * 순서라 여기서 끊으면 카드까지 내려가지 않는다. */
    document.addEventListener("click", function (e) {
      var h = e.target.closest && e.target.closest("[data-fav]");
      if (!h) return;
      e.preventDefault();
      e.stopPropagation();
      var id = h.getAttribute("data-fav");
      var p = window.PetApp && window.PetApp.findAnyPlace && window.PetApp.findAnyPlace(id);
      if (!p) p = list().find(function (x) { return String(x.id) === String(id); });
      if (p) toggle(p);
    }, true);

    document.addEventListener("click", function (e) {
      var open = e.target.closest && e.target.closest("[data-fav-open]");
      if (open) {
        e.preventDefault();
        var oid = open.getAttribute("data-fav-open");
        var saved = list().find(function (x) { return String(x.id) === String(oid); });
        togglePanel(false);
        if (window.PetApp && window.PetApp.adoptPlace && saved) window.PetApp.adoptPlace(saved);
        return;
      }
      var del = e.target.closest && e.target.closest("[data-fav-del]");
      if (del) { e.preventDefault(); remove(del.getAttribute("data-fav-del")); return; }
      if (e.target.closest && e.target.closest("#favToList")) {
        e.preventDefault();
        togglePanel(false);
        if (window.PetApp && window.PetApp.showFavorites) window.PetApp.showFavorites();
        return;
      }
      if (e.target.closest && e.target.closest("#favSignOut")) { e.preventDefault(); signOut(); return; }
      if (e.target.closest && e.target.closest("#favClear")) {
        e.preventDefault();
        if (window.confirm(T("fav.clearAsk"))) clear();
        return;
      }
      var fb = e.target.closest && e.target.closest("#favBtn");
      if (fb) { e.stopPropagation(); togglePanel(); return; }
      if (e.target.closest && e.target.closest("#favPop")) return;   // 패널 안 클릭은 유지
      togglePanel(false);                                            // 바깥 클릭 → 닫기
    });

    var close = document.getElementById("favPopClose");
    if (close) close.addEventListener("click", function () { togglePanel(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") togglePanel(false); });

    /* 지역 팝오버와 서로 밀어내기 — 지역 버튼은 자기 클릭을 stopPropagation 으로
     * 막아 두어 문서까지 오지 않는다. 같은 버튼에 직접 붙이면 그래도 실행된다
     * (stopPropagation 은 같은 요소의 다른 리스너는 막지 않는다). */
    var rb = document.getElementById("regionBtn");
    if (rb) rb.addEventListener("click", function () { togglePanel(false); });

    /* 목록·상세가 다시 그려지면 하트 상태를 다시 입힌다.
     * 한 번의 렌더에서 변경 알림이 여러 번 오므로 0ms 타이머로 묶는다.
     * requestAnimationFrame 은 쓰지 않는다 — 백그라운드 탭에서는 아예 돌지 않아
     * 탭을 보기 전까지 하트가 빈 채로 남는다(실측 확인). */
    var queued = false;
    var obs = new MutationObserver(function () {
      if (queued) return;
      queued = true;
      setTimeout(function () {
        queued = false;
        paintAll();
        /* 방금 우리가 만든 변경은 우리가 알 필요가 없다 — 큐를 비워 되돌아오는
         * 알림을 끊는다. (paintAll 이 바뀐 것만 손대므로 이것 없이도 한 바퀴에
         * 멈추지만, 애초에 한 바퀴도 돌지 않게 한다) */
        obs.takeRecords();
      }, 0);
    });
    ["placeList", "detailBody", "hotRail", "aiResult"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) obs.observe(el, { childList: true, subtree: true });
    });

    // 언어를 바꾸면 라벨·툴팁·패널을 다시 그린다
    document.addEventListener("petmap:lang", function () {
      var t = document.getElementById("favPopTitle");
      if (t) t.textContent = T("fav.title");
      var b = document.getElementById("favBtn");
      if (b) b.setAttribute("title", T("fav.btnTitle"));
      paintAll();
      renderPanel();
    });
  }

  /* ══════════ 공개 API ══════════ */

  window.PetFav = {
    list: list, has: has, add: add, remove: remove, toggle: toggle, clear: clear,
    count: function () { return list().length; },
    paint: paintAll,
    open: function () { togglePanel(true); },
    /** 장소 카드/상세에 심을 하트 버튼 마크업 — app.js 가 문자열로 끼워 넣는다 */
    button: function (id, cls) {
      return '<button type="button" class="fav-btn ' + (cls || "") + '" data-fav="' + esc(id) + '" ' +
             'aria-pressed="false" title="' + esc(T("fav.add")) + '"></button>';
    },
    onChange: function (f) { if (typeof f === "function") favListeners.push(f); },
    /** 다른 화면(앱 첫 화면 등)에도 같은 구글 공식 버튼을 심어 준다.
     *  클라이언트 ID 가 없으면 아무것도 그리지 않고 호스트를 감춘다. */
    mountLogin: function (host) {
      if (!host) return;
      if (!loginEnabled()) { host.style.display = "none"; return; }
      mountGoogleButton(host);
    }
  };

  window.PetAccount = {
    user: function () { return user; },
    isLoginEnabled: loginEnabled,
    signOut: signOut,
    onChange: function (f) { if (typeof f === "function") accListeners.push(f); }
  };

  bind();
  paintAll();
})();
