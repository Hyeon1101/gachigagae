/* ─────────────────────────────────────────────────────────────
 * 📤 SNS 공유 — 카카오톡 · 인스타그램 · X
 *
 *  누르면 그 자리에서 해당 서비스가 열려야 한다. 문구만 복사해 두고
 *  "붙여 넣으세요"로 끝내면 공유는 거기서 끊긴다. 그래서 서비스마다
 *  실제로 연결되는 경로를 따로 잡았다.
 *
 *    카카오톡   Kakao JavaScript SDK(Share.sendDefault)
 *               → 휴대폰은 카카오톡 앱, PC는 「카카오톡으로 보내기」 창
 *    X          intent/post — 앱이 깔려 있으면 앱으로 넘어간다
 *    인스타그램  글을 채워 주는 공개 링크가 없는 유일한 곳이다
 *               → 문구를 클립보드에 넣고 인스타그램 앱(없으면 웹)을 바로 연다
 *
 *  [공유] 버튼을 처음 누르면 휴대폰에서는 시스템 공유 시트를 먼저 띄운다.
 *  설치된 앱이 전부 뜨는 가장 확실한 길이고, 시트가 없는 환경(PC 웹·웹뷰)에서만
 *  위 서비스 선택 줄을 펼친다.
 *
 *  공유 링크는 그 장소로 바로 들어가는 주소다(?place=…).
 *  받은 사람이 링크를 누르면 목록을 헤맬 필요 없이 그 장소 상세가 열린다.
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var SITE = "https://ggagae.com";
  var T = function (k, v) { return window.T ? window.T(k, v) : k; };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function toast(msg) {
    if (window.PetAppShell && window.PetAppShell.toast) return window.PetAppShell.toast(msg);
    var el = document.getElementById("appToast") || document.getElementById("favToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "favToast";
      el.className = "fav-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  /** 그 장소로 바로 들어가는 주소 — 링크만 눌러도 상세가 열린다.
   *  되살릴 수 있는 건 TourAPI contentId(숫자)뿐이다. 문화정보원에서 온 장소는
   *  id 가 culture-이름-좌표 형태라 조회할 방법이 없으니 그냥 홈으로 보낸다. */
  function linkOf(p) {
    return p && p.id && /^\d+$/.test(String(p.id))
      ? SITE + "/?place=" + encodeURIComponent(p.id)
      : SITE;
  }

  /** 공유 문구 만들기 — 받는 사람이 이것만 보고도 어디인지 알 수 있게 */
  function textOf(p) {
    if (!p) return T("sh.appText") + "\n" + SITE;
    var lines = ["🐾 " + (p.title || "")];
    if (p.addr) lines.push("📍 " + p.addr);
    if (p.verdictLabel) lines.push("✅ " + p.verdictLabel);
    lines.push(T("sh.via"));
    return lines.join("\n") + "\n" + linkOf(p);
  }

  /** 클립보드 — 권한이 막힌 브라우저를 위해 execCommand 까지 내려간다 */
  function copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
    } catch (_) {}
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (_) {}
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error("no clipboard"));
    });
  }

  function isMobile() {
    return /android|iphone|ipad|ipod/i.test(navigator.userAgent || "");
  }

  function openTab(url) {
    var w = window.open(url, "_blank", "noopener");
    if (!w) location.href = url;
  }

  /** 앱 스킴을 먼저 두드리고, 열리지 않으면 웹으로 넘어간다 */
  function openApp(scheme, web) {
    if (!isMobile()) return openTab(web);
    var left = false;
    var onHide = function () { left = true; };
    document.addEventListener("visibilitychange", onHide, { once: true });
    location.href = scheme;
    setTimeout(function () {
      document.removeEventListener("visibilitychange", onHide);
      if (!left && !document.hidden) openTab(web);
    }, 1200);
  }

  /* ══════════ 서비스별 연결 ══════════ */

  function shareX(p) {
    openTab("https://x.com/intent/post?text=" + encodeURIComponent(textOf(p)) +
            "&url=" + encodeURIComponent(linkOf(p)));
  }

  function shareKakao(p) {
    var url = linkOf(p);
    var desc = p ? [p.addr, p.verdictLabel].filter(Boolean).join("\n") : T("sh.appText");
    var img = (p && p.img) || (SITE + "/assets/hero-dog.jpg");
    if (/^http:/i.test(img)) img = img.replace(/^http:/i, "https:");

    var go = window.PetKakao
      ? window.PetKakao.share({
          title: (p && p.title) || "같이가개",
          description: desc,
          imageUrl: img,
          link: url,
          buttonTitle: T("sh.kakaoBtn")
        })
      : Promise.reject(new Error("no kakao module"));

    return go.catch(function () {
      // 키·도메인 문제로 SDK 가 열리지 않을 때: 문구를 담아 주고 카카오톡을 연다
      copy(textOf(p)).catch(function () {});
      toast(T("sh.kakaoFallback"));
      openApp("kakaotalk://", "https://www.kakaocorp.com/page/service/service/KakaoTalk");
    });
  }

  function shareInsta(p) {
    // 인스타그램은 외부에서 글을 채워 넣는 공개 링크가 없다
    // → 문구를 클립보드에 담고 앱(없으면 웹)을 곧바로 연다
    copy(textOf(p))
      .then(function () { toast(T("sh.instaCopied")); })
      .catch(function () { toast(T("sh.copyFail")); });
    openApp("instagram://app", "https://www.instagram.com/");
  }

  /** 시스템 공유 시트 — 휴대폰에서 설치된 카카오톡·인스타그램·X 가 전부 여기 뜬다 */
  function systemShare(p) {
    if (!navigator.share) return Promise.reject(new Error("no share api"));
    return navigator.share({
      title: (p && p.title) || "같이가개",
      text: textOf(p),
      url: linkOf(p)
    });
  }

  /** 서비스 하나를 직접 여는 경로 (공유 시트가 없을 때) */
  function shareTo(kind, p) {
    if (kind === "x") return shareX(p);
    if (kind === "kakao") return shareKakao(p);
    if (kind === "insta") return shareInsta(p);
    copy(textOf(p)).then(function () { toast(T("sh.copied")); })
                   .catch(function () { toast(T("sh.copyFail")); });
  }

  /** 메뉴는 기본이 위로 펼치기다. 상세 맨 위처럼 위가 막힌 자리에서는 아래로 돌린다
   *  (상단바가 z-index 900 이라, 그냥 위로 펴면 헤더에 가려 눌리지 않는다) */
  function orient(host) {
    var need = 190;                                  // 메뉴 한 벌 높이 + 여백
    var top = document.querySelector(".topbar");
    var limit = (top ? top.getBoundingClientRect().bottom : 0) + 8;
    host.classList.toggle("drop", host.getBoundingClientRect().top - need < limit);
  }

  /** 버튼 하나로 시작 — 휴대폰이면 공유 시트, 아니면 서비스 선택 줄을 펼친다 */
  function share(p, host) {
    systemShare(p).catch(function (err) {
      // 사용자가 시트를 그냥 닫은 것은 실패가 아니다
      if (err && /abort/i.test(err.name || err.message || "")) return;
      if (host) {
        orient(host);
        host.classList.toggle("show");
        // 메뉴가 열리는 순간 카카오 SDK를 미리 받아 둔다 — 실제 클릭에서 창이 막히지 않게
        if (host.classList.contains("show") && window.PetKakao) window.PetKakao.warm();
      }
      else shareTo("copy", p);
    });
  }

  /** 장소 상세·카드에 붙일 공유 버튼 묶음 마크업 */
  function buttons(id) {
    /* 상세가 그려지는 이 순간부터 카카오 SDK 를 미리 받아 둔다.
     * 메뉴를 열 때 시작하면, 바로 이어서 카카오톡을 누른 사용자에게는
     * 아직 준비가 안 끝나 창이 팝업 차단에 걸린다(실제 배포본에서 확인). */
    if (window.PetKakao) window.PetKakao.warm();
    return '<div class="sh-wrap">' +
      '<button type="button" class="sh-btn" data-share-place="' + esc(id) + '">' +
        (window.Icon ? window.Icon("share") : "") + "<span>" + T("sh.share") + "</span></button>" +
      '<div class="sh-menu">' +
        '<button type="button" class="sh-one sh-kakao" data-share-to="kakao" data-share-id="' + esc(id) + '">' + T("sh.kakao") + "</button>" +
        '<button type="button" class="sh-one sh-insta" data-share-to="insta" data-share-id="' + esc(id) + '">' + T("sh.insta") + "</button>" +
        '<button type="button" class="sh-one sh-x" data-share-to="x" data-share-id="' + esc(id) + '">' + T("sh.x") + "</button>" +
      "</div></div>";
  }

  function findPlace(id) {
    var app = window.PetApp;
    if (!app) return null;
    return (app.findPlace && app.findPlace(id)) ||
           (app.findAnyPlace && app.findAnyPlace(id)) || null;
  }

  document.addEventListener("click", function (e) {
    var one = e.target.closest && e.target.closest("[data-share-to]");
    if (one) {
      e.preventDefault();
      e.stopPropagation();
      shareTo(one.getAttribute("data-share-to"), findPlace(one.getAttribute("data-share-id")));
      var m = one.closest(".sh-wrap");
      if (m) m.classList.remove("show");
      return;
    }
    /* ⚠️ data-share 가 아니라 data-share-place 다.
     * 반려동물 상식 퀴즈의 결과 공유 버튼도 data-share 를 쓰기 때문에,
     * 예전 이름 그대로 두면 이 위임 핸들러가 퀴즈 쪽 클릭까지 가로채
     * (stopPropagation) 퀴즈 공유가 통째로 죽는다. */
    var btn = e.target.closest && e.target.closest("[data-share-place]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    share(findPlace(btn.getAttribute("data-share-place")), btn.closest(".sh-wrap"));
  }, true);

  /* 메뉴가 열린 채로 다른 곳을 누르면 닫는다 */
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest(".sh-wrap")) return;
    document.querySelectorAll(".sh-wrap.show").forEach(function (w) { w.classList.remove("show"); });
  });

  window.PetShare = { share: share, shareTo: shareTo, buttons: buttons, text: textOf, link: linkOf };
})();
