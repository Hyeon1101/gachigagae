/* ─────────────────────────────────────────────────────────────
 * 도우미 마스코트 "가개(강아지)/냥이(고양이)"
 * 지도 요소를 가리지 않는 코너 위젯 — 상황별 팁 말풍선
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);

  const CHARS = {
    dog: { img: "assets/helper_dog.png", name: "가개", emoji: "🐶" },
    cat: { img: "assets/helper_cat.png", name: "냥이", emoji: "🐱" }
  };
  const IDLE_TIPS = [
    "🐶 프로필을 설정하면 장소마다 <b>입장 가능 여부</b>를 판정해줘!",
    "🎒 상세 화면의 <b>체크리스트</b>만 챙기면 헛걸음 끝!",
    "🏞️ 식당을 고르면 <b>근처 동반 가능 관광지</b>도 추천해줘.",
    "📞 <b>확인 전</b> 배지가 있는 곳은 방문 전 전화 확인이 안전해.",
    "🗺️ <b>길안내</b> 버튼을 누르면 카카오맵 길찾기로 바로 연결돼!",
    "🛍️ 상단 칩에서 <b>쇼핑·편의</b>, <b>문화·공공시설</b>도 볼 수 있어."
  ];
  const TAB_TIPS = {
    "39": "🍽️ 식당·카페는 <b>실외석만 가능</b>한 곳이 많으니 판정 배지를 꼭 확인해!",
    "12": "🏞️ 공원은 대부분 <b>목줄 2m + 배변봉투</b>면 OK. 실내 시설은 제외야.",
    "14": "🏛️ 문화·공공시설은 <b>안내견만 가능</b>한 곳도 있어. 판정을 믿어줘!",
    "38": "🛍️ 쇼핑몰은 <b>유모차/케이지 규정</b>이 제각각이야. 규정 카드를 확인해.",
    "32": "🏨 숙박은 <b>추가 요금·마릿수 제한</b>이 흔해. 예약 전 전화 추천!",
    "28": "⚽ 반려견 놀이터는 <b>동물등록증</b>이 필요한 곳이 많아.",
    "culture:trip": "✈️ 박물관·펜션·여행지 <b>2,742곳</b>! 운영시간과 휴무일도 함께 확인해줘.",
    "culture:cafe": "☕ 반려동물 전용 <b>카페·식당 853곳</b>. 입장 가능 크기를 꼭 확인해!",
    "culture:service": "🛁 미용·호텔·용품점 등 <b>펫서비스 8,276곳</b>이야.",
    "culture:medical": "🏥 <b>동물병원·약국 58,778곳</b>. 여행 중 응급상황에 대비해 위치를 알아두자!"
  };

  let kind = localStorage.getItem("petmap_helper_kind") || "dog";
  let hidden = localStorage.getItem("petmap_helper_hidden") === "1";
  let idleTimer = null, idleIdx = 0;

  function el() { return $("#helper"); }

  function say(html, holdMs = 12000) {
    const b = $("#helperBubble"), t = $("#helperText");
    if (!b || hidden) return;
    t.innerHTML = html;
    b.style.animation = "none";
    void b.offsetWidth;             // 애니메이션 재시작
    b.style.animation = "";
    restartIdle(holdMs);
  }

  function idleTick() {
    say(IDLE_TIPS[idleIdx % IDLE_TIPS.length], 25000);
    idleIdx++;
  }
  function restartIdle(delay) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(idleTick, delay);
  }

  function applyKind() {
    const c = CHARS[kind];
    $("#helperImg").src = c.img;
    localStorage.setItem("petmap_helper_kind", kind);
  }

  function applyHidden() {
    el().classList.toggle("min", hidden);
    localStorage.setItem("petmap_helper_hidden", hidden ? "1" : "0");
  }

  const Helper = {
    init() {
      applyKind();
      applyHidden();
      $("#helperSwap").addEventListener("click", () => {
        kind = kind === "dog" ? "cat" : "dog";
        applyKind();
        window.dispatchEvent(new CustomEvent("petmap:helperChanged", { detail: { kind } }));
        say(`${CHARS[kind].emoji} 이제 <b>${CHARS[kind].name}</b>가 도와줄게!`);
      });
      $("#helperHide").addEventListener("click", () => { hidden = true; applyHidden(); });
      $("#helperImg").addEventListener("click", () => {
        if (hidden) { hidden = false; applyHidden(); say("다시 왔어! 🐾"); }
        else idleTick();
      });
      restartIdle(9000);
    },
    onListLoaded(state) {
      if (state.demoMode) {
        say("⚠️ 지금은 <b>샘플 데이터</b>야. API 연결되면 실제 데이터로 바뀌어!");
      } else if (!state.profile) {
        say("👋 <b>내 반려동물 설정</b>부터 하면 입장 가능 여부를 알려줄게!");
      }
    },
    onTabChange(type) {
      if (TAB_TIPS[type]) say(TAB_TIPS[type]);
    },
    onProfileSaved(p) {
      say(`✅ <b>${p.name}</b> 정보 저장 완료! 이제 지도의 핀 색으로 판정을 확인해봐.`);
    },
    onSelect(place, verdict) {
      const msgs = {
        ok: `✅ <b>${place.title}</b>, 규정상 입장 가능! 그래도 체크리스트는 확인하자.`,
        cond: `⚠️ <b>${place.title}</b>는 조건부야. 아래 <b>사유</b>를 꼭 읽어봐!`,
        no: `❌ 여긴 어려워… 근처의 <b>입장 가능</b>한 곳을 추천해줄게.`,
        unknown: `❔ 규정 정보가 없어. ${place.tel ? "전화로 확인하는 게 안전해!" : "방문 전 확인을 추천해!"}`
      };
      say(msgs[verdict.status] || msgs.unknown);
    },
    say
  };

  window.Helper = Helper;
})();
