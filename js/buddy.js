/* ─────────────────────────────────────────────────────────────
 * 가개 도우미 — 화면을 따라다니는 마스코트
 *
 *  · 기존 로고(assets/helper_dog.png)가 화면 오른쪽 아래에 고정으로 붙어
 *    어느 페이지를 스크롤해도 따라다니며 상황에 맞는 안내를 띄운다.
 *  · AI 검색이 시작되면 달리는 스프라이트(dog_run_1~4, Higgsfield 로 만든 것)로
 *    바뀌어 좌우로 뛴다. 소리는 내지 않는다(사용자 요청으로 제거).
 *  · 안내가 불편한 사용자를 위한 장치
 *      [안내 끄기]  말풍선·마스코트를 통째로 숨긴다(작은 [도우미 켜기]만 남음)
 *      이 설정은 localStorage 에 남아 다음 방문에도 유지된다.
 *      OS 에서 "동작 줄이기"를 켠 사용자에게는 뛰는 연출을 하지 않는다.
 *
 * 모달·상세 패널이 열리면 잠시 물러난다(.bd-hold). 검색 중에는 모달이
 * 도우미를 가리므로, 모달 안 마스코트(#aiMascot)도 같은 프레임으로 함께 달린다.
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var T = function (k, v) { return window.T ? window.T(k, v) : k; };

  var KEY_OFF = "petmap_buddy_off";
  var KEY_SEEN = "petmap_buddy_seen";

  var FRAMES = [
    "assets/dog_run_1.png", "assets/dog_run_2.png",
    "assets/dog_run_3.png", "assets/dog_run_4.png"
  ];
  var FRAME_MS = 110;          // 약 9fps — 통통 뛰는 만화 속도
  var BUBBLE_MS = 15000;       // 말풍선을 접기까지
  var IDLE_MS = 40000;         // 다음 팁까지
  var AUTO_TIPS = 3;           // 먼저 말을 거는 횟수 — 그 뒤로는 눌렀을 때만

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  };

  var off = store.get(KEY_OFF) === "1";
  var lessMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var TIP_KEYS = ["bd.tip1", "bd.tip2", "bd.tip3", "bd.tip4", "bd.tip5", "bd.tip6"];
  var tipIdx = 0, autoLeft = AUTO_TIPS;
  var idleTimer = null, foldTimer = null, nudgeTimer = null, lastNudge = 0;

  var el = {};                 // buddy, bubble, say, dog, img, offBtn, onBtn

  function isDog() { return (store.get("petmap_helper_kind") || "dog") !== "cat"; }
  function mascotSrc() {
    return window.Icon && window.Icon.mascotSrc
      ? window.Icon.mascotSrc()
      : (isDog() ? "assets/helper_dog.png" : "assets/helper_cat.png");
  }

  /* ══════════ 러닝 프레임 재생 ══════════
   * 프레임을 미리 받아 두고 <img>.src 만 돌린다. 도우미와 모달 마스코트가
   * 같은 타이머를 쓰기 때문에 둘이 어긋나지 않는다. */
  var runners = [], ticker = null, frame = 0;

  function preload() { FRAMES.forEach(function (src) { new Image().src = src; }); }

  function startTicker() {
    if (ticker || lessMotion) return;          // 동작 줄이기 = 한 장으로 고정
    ticker = setInterval(function () {
      /* 화면에서 떨어져 나간 <img> 는 버린다. 모달이 다시 그려지면 예전 노드가
       * 목록에 남아 runners 가 절대 비지 않고, 그러면 stopTicker 가 영영 안 돌아
       * 두 번째 검색부터 엉뚱한 노드에 프레임을 그리게 된다. */
      for (var i = runners.length - 1; i >= 0; i--) {
        if (!runners[i].isConnected) runners.splice(i, 1);
      }
      if (!runners.length) { stopTicker(); return; }
      frame = (frame + 1) % FRAMES.length;
      runners.forEach(function (img) { img.src = FRAMES[frame]; });
    }, FRAME_MS);
  }
  function stopTicker() { clearInterval(ticker); ticker = null; }

  function addRunner(img) {
    if (!img) return;
    // 같은 자리에 새로 그려진 노드일 수 있으니, 끊어진 것부터 정리하고 다시 담는다
    for (var i = runners.length - 1; i >= 0; i--) {
      if (!runners[i].isConnected) runners.splice(i, 1);
    }
    if (runners.indexOf(img) >= 0) return;
    runners.push(img);
    img.src = FRAMES[frame];
    startTicker();
  }
  function removeRunner(img, restoreSrc) {
    var i = runners.indexOf(img);
    if (i >= 0) runners.splice(i, 1);
    if (img && restoreSrc) img.src = restoreSrc;
    if (!runners.length) stopTicker();
  }

  /* ══════════ 말풍선 ══════════ */
  function say(html, o) {
    if (off || !el.bubble) return;
    o = o || {};
    el.say.innerHTML = html;
    el.bubble.classList.remove("hidden");
    el.bubble.style.animation = "none";
    void el.bubble.offsetWidth;                // 애니메이션 재시작
    el.bubble.style.animation = "";
    if (o.trot !== false) nudge();
    clearTimeout(foldTimer);
    if (o.hold !== false) foldTimer = setTimeout(fold, o.ms || BUBBLE_MS);
    restartIdle();
  }
  function fold() { if (el.bubble) el.bubble.classList.add("hidden"); }

  function nudge() {
    if (lessMotion || !el.buddy || el.buddy.classList.contains("bd-run")) return;
    el.buddy.classList.remove("bd-nudge");
    void el.buddy.offsetWidth;
    el.buddy.classList.add("bd-nudge");
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(function () { el.buddy.classList.remove("bd-nudge"); }, 520);
  }

  /** 안내마다 "그래서 어디로 가면 되는지"가 있다 — 말로만 알려 주고 끝내지 않는다.
   *  다만 누르자마자 화면이 휙 바뀌면 곤란하므로 반드시 한 번 물어본다. */
  var TIP_GO = {
    "bd.tip1": "profile",   // 내 반려동물 정보 등록
    "bd.tip2": "list",      // 상세의 체크리스트 → 목록에서 한 곳 고르기
    "bd.tip3": "list",      // 확인 필요 배지
    "bd.tip4": "list",      // 길안내
    "bd.tip5": "region",    // 지역 바꾸기
    "bd.tip6": "search"     // 말하듯이 검색
  };

  function askRow(action) {
    if (!action) return "";
    return '<div class="bd-ask">' +
      '<span class="bd-ask-q">' + T("bd.ask") + "</span>" +
      '<button type="button" class="bd-go" data-bd-go="' + action + '">' + T("bd.goYes") + "</button>" +
      '<button type="button" class="bd-no" data-bd-no>' + T("bd.goNo") + "</button>" +
      "</div>";
  }

  function runTipAction(action) {
    var app = window.PetApp || {};
    fold();
    if (action === "profile" && app.openProfile) return app.openProfile();
    if (action === "region") {
      var rb = document.getElementById("regionBtn");
      if (rb) rb.click();
      return;
    }
    if (action === "search") {
      if (app.showPage) app.showPage("home");
      var box = document.getElementById("aiInput");
      if (box) setTimeout(function () { box.focus(); box.select(); }, 120);
      return;
    }
    if (app.showPage) app.showPage("results");
  }

  function nextTip() {
    var key = TIP_KEYS[tipIdx % TIP_KEYS.length];
    say(T(key) + askRow(TIP_GO[key]));
    tipIdx++;
  }
  /** 스스로 말을 거는 건 AUTO_TIPS 번까지만.
   *  계속 말풍선이 뜨면 그것부터 성가시다 — 그 뒤로는 눌러야 알려 준다. */
  function autoTip() {
    autoLeft--;
    nextTip();
  }
  function restartIdle() {
    clearTimeout(idleTimer);
    if (!off && autoLeft > 0) idleTimer = setTimeout(autoTip, IDLE_MS);
  }

  /* ══════════ 검색 중 — 달리기 ══════════ */
  function setSearching(on) {
    var modalDog = $("#aiMascot");             // 모달이 도우미를 가리므로 같이 달린다
    if (modalDog && isDog()) {
      if (on) addRunner(modalDog);
      else removeRunner(modalDog, mascotSrc());
    }
    if (off || !el.buddy) return;
    if (isDog()) {
      if (on) addRunner(el.img);
      else removeRunner(el.img, mascotSrc());
      /* 클래스를 그냥 다시 붙이면 이미 붙어 있던 경우 달리기 애니메이션이
       * 이어지지 않고 멈춘 것처럼 보인다 — 한 번 떼고 리플로를 준 뒤 붙인다. */
      el.buddy.classList.remove("bd-run");
      if (on) { void el.buddy.offsetWidth; el.buddy.classList.add("bd-run"); }
    }
    say(on ? T("bd.searching") : T("bd.found"), { trot: false });
  }

  /* ══════════ 켜기 / 끄기 ══════════ */
  function applyOff() {
    store.set(KEY_OFF, off ? "1" : "0");
    el.buddy.classList.toggle("bd-off", off);
    el.onBtn.classList.toggle("show", off);
    if (off) {
      clearTimeout(idleTimer); clearTimeout(foldTimer);
      removeRunner(el.img, mascotSrc());
      el.buddy.classList.remove("bd-run");
    } else {
      restartIdle();
    }
  }

  /* ══════════ 모달·상세 패널이 열리면 잠시 물러난다 ══════════ */
  function hiddenEl(sel) {
    var n = $(sel);
    return !n || n.classList.contains("hidden");
  }
  function syncHold() {
    if (!el.buddy) return;
    el.buddy.classList.toggle("bd-hold", !hiddenEl("#aiModal") || !hiddenEl("#detailPanel"));
  }
  function watchOverlays() {
    var mo = new MutationObserver(syncHold);
    ["#aiModal", "#detailPanel"].forEach(function (sel) {
      var n = $(sel);
      if (n) mo.observe(n, { attributes: true, attributeFilter: ["class"] });
    });
    syncHold();
  }

  /* ══════════ 라벨 ══════════ */
  function renderLabels() {
    el.dog.title = T("bd.dogTitle");
    el.dog.setAttribute("aria-label", T("bd.dogTitle"));
    el.offBtn.innerHTML = (window.Icon ? window.Icon("close") : "") + "<span>" + T("bd.off") + "</span>";
    el.offBtn.title = T("bd.offTitle");
    el.onBtn.title = T("bd.onTitle");
    el.onLabel.textContent = T("bd.on");
    el.onImg.src = mascotSrc();
  }

  /* ══════════ 만들기 ══════════ */
  function build() {
    var wrap = document.createElement("div");
    wrap.id = "buddy";
    wrap.innerHTML =
      '<div class="bd-bubble hidden" id="bdBubble" role="status" aria-live="polite">' +
        '<div class="bd-say" id="bdSay"></div>' +
        '<div class="bd-tools">' +
          '<button type="button" id="bdOff"></button>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="bd-dog" id="bdDog">' +
        '<img id="bdImg" src="' + mascotSrc() + '" alt="">' +
      '</button>';
    document.body.appendChild(wrap);

    var on = document.createElement("button");
    on.type = "button";
    on.id = "buddyOn";
    on.innerHTML = '<img id="bdOnImg" src="' + mascotSrc() + '" alt=""><span id="bdOnLabel"></span>';
    document.body.appendChild(on);

    el = {
      buddy: wrap, bubble: $("#bdBubble"), say: $("#bdSay"), dog: $("#bdDog"),
      img: $("#bdImg"), offBtn: $("#bdOff"),
      onBtn: on, onImg: $("#bdOnImg"), onLabel: $("#bdOnLabel")
    };
  }

  function bind() {
    // 강아지를 누르면 다음 안내 — 안내마다 "그 화면으로 갈까요?" 를 함께 묻는다
    el.dog.addEventListener("click", function () {
      nextTip();
    });

    /* 말풍선 안의 [연결하기] / [아니요] */
    el.bubble.addEventListener("click", function (e) {
      var go = e.target.closest && e.target.closest("[data-bd-go]");
      if (go) { e.preventDefault(); runTipAction(go.getAttribute("data-bd-go")); return; }
      if (e.target.closest && e.target.closest("[data-bd-no]")) { e.preventDefault(); fold(); }
    });

    el.offBtn.addEventListener("click", function () {
      off = true;
      applyOff();
    });
    el.onBtn.addEventListener("click", function () {
      off = false;
      applyOff();
      say(T("bd.back"));
      el.onBtn.blur();
    });

    // AI 검색 시작/종료 — ai.js 의 thinking() 이 알려 준다
    document.addEventListener("petmap:searching", function (e) {
      setSearching(!!(e.detail && e.detail.on));
    });

    // 화면을 옮기면 그 화면에 맞는 안내를 한 줄
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-page]");
      if (!b || off) return;
      var key = "bd.page." + b.getAttribute("data-page");
      var msg = T(key);
      if (msg && msg !== key) setTimeout(function () { say(msg); }, 260);
    });

    // 스크롤하면 진행 방향으로 잠깐 반응한다 — .page 가 스크롤 컨테이너라 캡처로 받는다
    document.addEventListener("scroll", function () {
      var now = Date.now();
      if (off || now - lastNudge < 2600) return;
      lastNudge = now;
      nudge();
    }, true);

    // 언어를 바꾸면 버튼 라벨과 팁을 다시 그린다
    document.addEventListener("petmap:lang", function () {
      renderLabels();
      if (el.bubble && !el.bubble.classList.contains("hidden")) nextTip();
    });

    // 도우미 종류(강아지/고양이)가 바뀌면 그림을 맞춘다
    window.addEventListener("petmap:helperChanged", function () {
      if (!runners.length) el.img.src = mascotSrc();
      el.onImg.src = mascotSrc();
    });
  }

  function init() {
    build();
    bind();
    renderLabels();
    applyOff();
    watchOverlays();
    preload();

    if (off) return;
    // 첫 방문에는 인사와 함께 "끄는 법"부터 알려 준다
    var first = store.get(KEY_SEEN) !== "1";
    if (first) store.set(KEY_SEEN, "1");
    /* 앱에서는 긴 인사를 하지 않는다 — 홈이 폰 한 화면이라 다섯 줄짜리
     * 말풍선이 22초 동안 카테고리 버튼을 덮고 있었다. 끄는 법은 말풍선 안의
     * [안내 끄기] 버튼이 이미 보여 주므로 글로 또 설명하지 않는다. */
    var isApp = !!(window.PETMAP_CONFIG && window.PETMAP_CONFIG.IS_NATIVE_APP);
    var longIntro = first && !isApp;
    setTimeout(function () {
      say(T("bd.hello") + (longIntro ? '<br><span class="bd-hint">' + T("bd.offHint") + "</span>" : ""),
          { ms: longIntro ? 22000 : (isApp ? 7000 : BUBBLE_MS) });
    }, 1200);
  }

  window.PetBuddy = {
    say: say,
    enable: function () { off = false; applyOff(); },
    disable: function () { off = true; applyOff(); },
    isOff: function () { return off; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
