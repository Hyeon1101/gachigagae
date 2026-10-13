/* ─────────────────────────────────────────────────────────────
 * 같이가개 AI 도우미 (Google Gemini)
 *  - 자연어 검색: 질문 → 검색 조건 해석 → 데이터 로드 → 추천 3곳
 *  - 견종 분류 : 품종명 → 크기·무게·주의사항 → 프로필 자동 입력
 *  - 길안내    : 구글 지도 열기 / 경로 안내
 * 키는 서버(Netlify Function)에만 있고 브라우저에는 없다.
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const T = (k, v) => window.T(k, v);

  const MASCOT = () =>
    (localStorage.getItem("petmap_helper_kind") || "dog") === "cat"
      ? "assets/helper_cat.png" : "assets/helper_dog.png";

  /** 서버 AI 호출. 브라우저 fetch 에는 시한이 없어 Gemini 가 늦으면 말풍선이 영영
   *  「생각하는 중」에 머문다 → 시한을 넘기면 실패로 보고 로컬 해석으로 넘어간다. */
  async function callAI(payload, ms) {
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), ms || 15000) : null;
    let res, json;
    try {
      res = await fetch(window.API("/api/ai"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ lang: window.I18N.lang }, payload)),
        signal: ctrl ? ctrl.signal : undefined
      });
      json = await res.json().catch(() => ({}));
    } catch (e) {
      const err = new Error(e && e.name === "AbortError" ? "TIMEOUT" : "NETWORK");
      err.code = err.message;
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (!res.ok || json.error || !json.data) {
      const err = new Error(json.message || json.error || `AI ${res.status}`);
      err.code = json.error || `HTTP_${res.status}`;
      throw err;
    }
    return json.data;
  }

  /* ══════════ AI 없이 조건 읽기 (로컬 해석) ══════════
   * 홈 검색창은 AI 전용이라, Gemini 가 한도·과부하·네트워크로 답을 못 하면 검색 자체가
   * 막혔다(2026-10-13 확인: 구글 프로젝트 월 지출 한도 초과로 「AI 응답을 받지 못했어요」만 떴다).
   * → 질문 속 낱말(지역·종류·크기·실내)만으로 조건을 만들어 검색은 끝까지 이어 간다. */
  const AREA_WORDS = [
    ["1", ["서울", "seoul", "강남", "홍대", "성수", "잠실", "여의도", "종로", "이태원", "마포", "용산"]],
    ["2", ["인천", "incheon", "강화", "영종", "을왕리"]],
    ["3", ["대전", "daejeon"]],
    ["4", ["대구", "daegu"]],
    ["5", ["광주광역", "gwangju"]],
    ["6", ["부산", "busan", "해운대", "광안리", "기장"]],
    ["7", ["울산", "ulsan"]],
    ["8", ["세종", "sejong"]],
    ["31", ["경기", "gyeonggi", "수원", "가평", "양평", "파주", "용인", "고양", "성남", "남양주", "포천", "이천", "화성", "평택", "안산", "김포", "광명", "하남"]],
    ["32", ["강원", "gangwon", "강릉", "속초", "춘천", "양양", "평창", "홍천", "정선", "원주", "고성", "삼척", "동해"]],
    ["33", ["충북", "충청북", "chungbuk", "청주", "단양", "충주", "제천"]],
    ["34", ["충남", "충청남", "chungnam", "태안", "보령", "공주", "부여", "천안", "아산", "서산"]],
    ["35", ["경북", "경상북", "gyeongbuk", "경주", "포항", "안동", "영덕", "울진", "문경"]],
    ["36", ["경남", "경상남", "gyeongnam", "통영", "거제", "남해", "창원", "진주", "하동", "김해"]],
    ["37", ["전북", "전라북", "jeonbuk", "전주", "군산", "남원", "부안", "무주"]],
    ["38", ["전남", "전라남", "jeonnam", "여수", "순천", "목포", "담양", "보성", "완도"]],
    ["39", ["제주", "jeju", "서귀포", "애월", "협재", "성산", "우도", "한라"]],
    ["5", ["광주"]]                     // 「경기 광주」보다 광주광역시가 흔하다 — 맨 끝에서만 잡는다
  ];
  const CAT_WORDS = [
    ["culture:medical", ["동물병원", "병원", "약국", "수의", "응급", "vet", "hospital", "pharmacy", "clinic"]],
    ["culture:service", ["미용", "호텔링", "유치원", "펫샵", "애견샵", "용품", "훈련", "목욕", "groom", "daycare", "pet shop", "pet hotel"]],
    ["culture:cafe", ["애견카페", "펫카페", "강아지카페", "고양이카페", "반려견카페", "애견 카페", "dog cafe", "pet cafe", "cat cafe"]],
    ["32", ["숙소", "숙박", "펜션", "호텔", "리조트", "캠핑", "글램핑", "민박", "게스트하우스", "풀빌라", "독채", "stay", "hotel", "pension", "resort", "camp", "lodging", "sleep"]],
    ["39", ["식당", "맛집", "카페", "음식", "레스토랑", "브런치", "밥", "먹을", "먹고", "커피", "restaurant", "cafe", "café", "eat", "food", "dining", "brunch", "coffee"]],
    ["28", ["놀이터", "운동장", "수영장", "레포츠", "액티비티", "체험", "서핑", "카약", "playground", "swim", "activity", "sport", "surf"]],
    ["38", ["쇼핑", "마트", "백화점", "아울렛", "시장", "몰", "shopping", "mall", "market", "outlet"]],
    ["14", ["박물관", "미술관", "전시", "도서관", "공연", "문화", "museum", "gallery", "exhibition", "library"]],
    ["12", ["관광", "명소", "공원", "산책", "해변", "바다", "해수욕장", "숲", "오름", "계곡", "호수", "여행", "나들이", "가볼", "놀러",
            "attraction", "park", "beach", "walk", "trip", "travel", "sightseeing", "hike", "forest", "lake"]]
  ];

  /** 질문 속에 들어 있는 품종 — 표준 견종표에서 가장 길게 맞는 이름을 고른다 */
  function breedIn(q) {
    const k = normKey(q);
    let best = null, len = 0;
    (BREEDS || []).forEach(b => b._keys.forEach(key => {
      if (key.length >= 2 && key.length > len && k.indexOf(key) >= 0) { best = b; len = key.length; }
    }));
    return best;
  }

  function localIntent(q) {
    const s = String(q || "").toLowerCase();
    // 영어 낱말은 단어 첫머리에서만 — "great" 안의 "eat" 같은 오탐을 막는다
    const has = (w) => /^[a-z ]+$/.test(w) ? new RegExp("\\b" + w).test(s) : s.indexOf(w) >= 0;
    let area = window.PetApp && window.PetApp.getArea ? window.PetApp.getArea() : "1";
    if (/전국|nationwide|anywhere|korea/.test(s)) area = "";
    for (const [code, words] of AREA_WORDS) { if (words.some(has)) { area = code; break; } }
    let category = "12";
    for (const [cat, words] of CAT_WORDS) { if (words.some(has)) { category = cat; break; } }
    let size = "any";
    if (/소형|작은|small|tiny|toy/.test(s)) size = "small";
    else if (/중형|medium|mid-size/.test(s)) size = "medium";
    else if (/대형|큰\s*(개|강아지|아이)|large|big dog/.test(s)) size = "large";
    else {
      const kg = s.match(/(\d+(?:\.\d+)?)\s*(kg|키로|킬로)/);
      const breed = breedIn(q);
      if (kg) size = window.PetRules.sizeFromWeight(parseFloat(kg[1]));
      else if (breed) size = breed.sizeClass;
    }
    const app = window.PetApp || {};
    return {
      area,
      areaName: app.areaName ? app.areaName(area) : "",
      category,
      categoryName: app.typeName ? app.typeName(category) : "",
      keyword: "",
      size,
      indoorOnly: /실내|indoor|inside/.test(s) && !/실외|outdoor/.test(s),
      reply: T("aj.localReply"),
      _local: true
    };
  }

  /* ══════════ 길안내 ══════════
   * 구글 지도는 한국 안에서 자동차 경로를 못 준다("현재 제공 중인 운전 경로 검색
   * 서비스 범위를 벗어난 검색입니다"). 게다가 destination에 위경도를 넣으면
   * 목적지 이름이 "37.5207260, 127.7298402" 같은 좌표로 표시된다.
   * → 국내 길안내는 카카오맵(기본)·네이버지도로 보내고, 구글은 위치 확인용으로만 쓴다.
   *
   * 좌표가 검수를 통과하지 못한 곳(PetGeo.verify → suspect)은 좌표를 아예 넘기지 않고
   * 이름+주소 검색으로 보낸다. 틀린 좌표로 안내하느니 검색 결과에서 고르게 하는 편이 낫다. */
  const enc = encodeURIComponent;

  /** 좌표를 길안내에 써도 되는지 — 검수 결과가 ok일 때만 true */
  function usableCoord(place) {
    if (!place || typeof place.lat !== "number" || typeof place.lng !== "number") return false;
    if (!isFinite(place.lat) || !isFinite(place.lng)) return false;
    if (place._geo === "suspect") return false;
    if (!place._geo && window.PetGeo && window.PetGeo.verify(place) === "suspect") return false;
    return true;
  }

  const nameAddr = (p) => `${p.title || ""} ${p.addr || ""}`.trim();

  const Route = {
    /** 카카오맵 길찾기 — 도착지 이름이 그대로 표시된다(실측 확인) */
    kakao(p) {
      return usableCoord(p)
        ? `https://map.kakao.com/link/to/${enc(p.title || "목적지")},${p.lat},${p.lng}`
        : `https://map.kakao.com/link/search/${enc(nameAddr(p))}`;
    },
    /** 구글 지도 — 경로가 아니라 장소 보기. 이름+주소로 찾으면 이름이 제대로 뜬다 */
    google(p) {
      return `https://www.google.com/maps/search/?api=1&query=${enc(nameAddr(p) || `${p.lat},${p.lng}`)}`;
    },
    /** 두 지점 사이 경로 — 카카오맵(국내에서 실제로 동작하는 쪽) */
    between(from, to) {
      if (!usableCoord(from) || !usableCoord(to)) return Route.kakao(to);
      return `https://map.kakao.com/link/from/${enc(from.title || "출발")},${from.lat},${from.lng}` +
             `/to/${enc(to.title || "도착")},${to.lat},${to.lng}`;
    },
    open(url) { window.open(url, "_blank", "noopener"); }
  };

  /* 기본 길안내 = 카카오맵. 예전 이름(GMap)으로 부르던 자리도 그대로 동작한다. */
  const GMap = {
    search: (p) => Route.google(p),
    directions: (p) => Route.kakao(p),
    between: (a, b) => Route.between(a, b),
    open: Route.open
  };

  /* ══════════ 모달 제어 ══════════ */
  function openModal() {
    $("#aiModal").classList.remove("hidden");
    $("#aiMascot").src = MASCOT();
  }
  function closeModal() { $("#aiModal").classList.add("hidden"); }
  function say(html) { $("#aiBubble").innerHTML = html; }
  /* 검색 중 표시 — 모달 마스코트가 들썩이고, 따라다니는 도우미(buddy.js)에게도
   * 알려서 달리는 스프라이트와 "멍멍" 소리를 함께 낸다. */
  function thinking(on) {
    $("#aiMascot").classList.toggle("thinking", !!on);
    document.dispatchEvent(new CustomEvent("petmap:searching", { detail: { on: !!on } }));
  }
  function setResult(html) { $("#aiResult").innerHTML = html; }

  /* ══════════ 자연어 검색 ══════════ */
  /* 질문을 연달아 보내면(예시 칩 두 개를 빠르게) 앞 질문의 늦은 답이 뒤 질문의 결과를
   * 덮어썼다 → 질문마다 번호를 매기고, 최신 질문이 아니면 화면을 건드리지 않는다. */
  let askSeq = 0;

  async function ask(q) {
    if (!q || !q.trim()) return;
    const seq = ++askSeq;
    const stale = () => seq !== askSeq;
    openModal();
    thinking(true);
    say(`<span class="ai-spinner"></span> ${T("aj.thinking", { q: escapeHtml(q) })}`);
    setResult("");

    let intent;
    try {
      await loadBreeds();                   // 로컬 해석이 품종으로 크기를 읽을 수 있게(이미 받아 둔 표)
      intent = await callAI({ mode: "search", q }, 12000);
    } catch (e) {
      // AI 가 못 하면 질문 속 낱말로 조건을 만들어 검색은 그대로 이어 간다
      console.warn("AI 검색 해석 실패 → 로컬 해석:", e.code || e.message);
      intent = localIntent(q);
    }
    if (stale()) return;

    // 조건 태그 표시
    const tags = [
      intent.areaName && ["pin", intent.areaName],
      intent.categoryName && ["tag", intent.categoryName],
      intent.size && intent.size !== "any" && ["size", T("aj.size" + intent.size.charAt(0).toUpperCase() + intent.size.slice(1))],
      intent.indoorOnly && ["indoor", T("aj.indoor")],
      intent.keyword && ["search", intent.keyword]
    ].filter(Boolean);
    const tagHtml = () => `<div class="ai-tags">${tags
      .map(([ic, t]) => `<span class="ai-tag">${window.Icon(ic)}${escapeHtml(t)}</span>`).join("")}</div>`;
    say(`${escapeHtml(intent.reply || T("aj.willFind"))}${tagHtml()}`);
    setResult(`<div class="empty-note" style="padding:14px;"><span class="ai-spinner"></span> ${T("aj.searching")}</div>`);

    // 앱에 조건 적용 → 데이터 로드
    let places = [];
    try {
      places = await window.PetApp.loadByIntent(intent);
    } catch (e) {
      if (stale()) return;
      thinking(false);
      setResult(`<div class="empty-note" style="padding:14px;">${T("aj.fail")}${escapeHtml(e.message)}</div>`);
      return;
    }
    if (stale()) return;

    if (!places.length) {
      thinking(false);
      say(`${escapeHtml(intent.reply || "")}${T("aj.notFound")}`);
      setResult(actionRow(intent));
      bindActions();
      return;
    }

    // 후보 상위 25곳을 Gemini에게 보내 추천 3곳 선정.
    // 장소 id가 "culture-상호-위도-경도" 형태라 Gemini가 그대로 되돌려주지 못한다
    // → 1~25 번호로 주고 번호로 되받는다.
    const cand = places.slice(0, 25);
    const listText = cand.map((p, i) =>
      `${i + 1}. ${p.title} | ${p.addr || ""} | 판정:${p.verdictLabel}${p.ruleText ? " | 규정:" + p.ruleText : ""}`
    ).join("\n");
    const petDesc = window.PetApp.petDescription();

    setResult(`<div class="empty-note" style="padding:14px;"><span class="ai-spinner"></span> ${T("aj.choosing", { n: places.length.toLocaleString() })}</div>`);
    let advice = null;
    // 조건 해석부터 AI 가 못 했으면 추천도 같은 이유로 못 한다 — 기다리지 않고 판정 순으로 고른다
    if (!intent._local) {
      try {
        advice = await callAI({ mode: "advise", q, places: listText, pet: petDesc }, 15000);
      } catch (_) { /* 추천 실패해도 목록은 보여준다 */ }
    }
    if (stale()) return;

    thinking(false);
    let picks = (advice && Array.isArray(advice.picks) ? advice.picks : [])
      .map(pk => {
        const n = parseInt(pk.no, 10);
        const byNo = n >= 1 && n <= cand.length ? cand[n - 1] : null;
        return { pk, place: byNo || cand.find(c => String(c.id).trim() === String(pk.id || "").trim()) };
      })
      .filter((x, i, arr) => x.place && arr.findIndex(y => y.place === x.place) === i);
    // AI가 id를 못 맞췄을 때도 빈손으로 두지 않는다 — 판정이 좋은 순으로 3곳
    if (!picks.length) {
      picks = cand.slice(0, 3).map(place => ({
        place,
        pk: { why: T(place.status === "ok" ? "aj.whyOk" : place.status === "cond" ? "aj.whyCond" : "aj.whyUnknown") }
      }));
    }

    if (advice && advice.reply) say(`${escapeHtml(advice.reply)}${tagHtml()}`);
    window.PetApp.markAiPicks(picks.map(x => String(x.place.id)));

    setResult(picks.map((x, i) => pickCard(x, i)).join("") + actionRow(intent, picks[0] && picks[0].place));
    bindPickCards();
    bindActions();
    // 평점·후기·사진은 네이버에서 뒤이어 채운다(카드가 먼저 뜨고 나중에 살이 붙는다)
    picks.forEach(x => hydratePlaceInfo(x.place));
  }

  /* ══════════ 추천 카드 ══════════
   * 헛걸음 방지 서비스라 "여기 갈 만한가"를 카드에서 바로 판단할 수 있어야 한다.
   * → 판정 배지 + 추천 이유 + 주소 + 평점/후기 + 길안내를 한 카드에 모은다. */
  function pickCard(x, i) {
    const p = x.place;
    return `<div class="ai-pick-card" data-id="${escapeAttr(p.id)}">
      <div class="pk-head">
        <span class="pk-n">${i + 1}</span>
        <span class="pk-title">${escapeHtml(p.title)}</span>
        <span class="badge badge-${p.status}">${escapeHtml(p.verdictLabel)}</span>
        ${window.PetFav ? window.PetFav.button(p.id, "pk-fav") : ""}
      </div>
      <div class="pk-why">${window.Icon("quote")}${escapeHtml(x.pk.why || "")}</div>
      <div class="pk-addr">${window.Icon("pin")}<span>${escapeHtml(p.addr || T("dt.noAddr"))}</span></div>
      <div class="pk-live" data-live="${escapeAttr(p.id)}">
        <span class="pk-live-load"><span class="ai-spinner"></span> ${T("aj.liveLoad")}</span>
      </div>
      <div class="pk-btns">
        <a class="pk-btn primary" target="_blank" rel="noopener" href="${Route.kakao(p)}">${window.Icon("route")} ${T("dt.routeKakao")}</a>
        <button type="button" class="pk-btn" data-open="${escapeAttr(p.id)}">${window.Icon("info")} ${T("dt.detailRule")}</button>
      </div>
    </div>`;
  }

  function bindPickCards() {
    $("#aiResult").querySelectorAll("[data-open]").forEach(b =>
      b.addEventListener("click", e => {
        e.stopPropagation();
        closeModal();
        window.PetApp.openPlace(b.getAttribute("data-open"));
      }));
    $("#aiResult").querySelectorAll(".ai-pick-card").forEach(c =>
      c.addEventListener("click", e => {
        if (e.target.closest("a,button")) return;
        closeModal();
        window.PetApp.openPlace(c.dataset.id);
      }));
  }

  /* ══════════ 네이버 플레이스 실사용 정보 ══════════
   * 공공데이터엔 평점·후기가 없다. /api/place 가 네이버 플레이스에서 받아 온다.
   * 같은 장소를 두 번 부르지 않도록 메모리에 캐시한다(서버는 CDN 24h 캐시). */
  const placeCache = new Map();

  function placeInfo(p, full) {
    const key = p.id + (full ? ":f" : "");
    if (placeCache.has(key)) return placeCache.get(key);
    const qs = new URLSearchParams({ q: p.title || "", addr: p.addr || "" });
    if (p.lng && p.lat) { qs.set("x", p.lng); qs.set("y", p.lat); }
    if (full) qs.set("full", "1");
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
    const pr = fetch(window.API(`/api/place?${qs}`), { signal: ctrl ? ctrl.signal : undefined })
      .then(r => r.json())
      .catch(() => ({ found: false, error: "NETWORK" }))
      .then(d => {
        if (timer) clearTimeout(timer);
        /* 실패(네트워크·네이버 차단·서버 오류)는 기억하지 않는다 — 예전엔 한 번 실패하면
         * 그 장소는 페이지를 새로 열 때까지 평점·사진이 영영 「정보 없음」이었다.
         * 진짜 「등록 안 됨」(found:false, 오류 없음)만 기억해 같은 곳을 또 묻지 않는다. */
        if (!d || d.error || d.throttled) placeCache.delete(key);
        return d || { found: false };
      });
    placeCache.set(key, pr);
    return pr;
  }

  function stars(rating) {
    if (!rating) return "";
    return `<span class="rt">${window.Icon("star")}<b>${rating.toFixed(1)}</b></span>`;
  }

  /** 카드의 평점·후기 자리를 실제 데이터로 채운다 */
  async function hydratePlaceInfo(p) {
    const box = document.querySelector(`[data-live="${CSS.escape(String(p.id))}"]`);
    if (!box) return;
    const d = await placeInfo(p, true);
    if (!document.body.contains(box)) return;
    if (!d || !d.found) {
      box.innerHTML = `<span class="pk-live-none">${window.Icon("info")} ${T("aj.liveNone")}</span>`;
      return;
    }
    const rev = (d.reviews || [])[0];
    box.innerHTML =
      `<div class="pk-live-row">
         ${d.thumb ? `<img class="pk-thumb" src="${escapeAttr(d.thumb)}" alt="" loading="lazy" decoding="async"
                        data-imgfail="remove">` : ""}
         <div class="pk-live-main">
           <div class="pk-rate">
             ${stars(d.rating)}
             ${d.reviewCount ? `<span class="rc">${T("dt.visitorReview", { n: d.reviewCount.toLocaleString() })}</span>` : ""}
             ${d.category ? `<span class="rcat">${escapeHtml(d.category)}</span>` : ""}
             ${d.phone ? `<a class="rtel" href="tel:${escapeAttr(d.phone)}">${window.Icon("phone")}${escapeHtml(d.phone)}</a>` : ""}
           </div>
           ${rev ? `<div class="pk-review">${window.Icon("quote")}<span>${escapeHtml(rev.body)}</span></div>` : ""}
           <a class="pk-naver" target="_blank" rel="noopener" href="${escapeAttr(d.url)}">${T("dt.moreNaver")}</a>
         </div>
       </div>`;
  }

  function actionRow() {
    return `<div class="ai-actions">
      <button class="btn btn-primary btn-sm" data-act="list">${window.Icon("list")} ${T("aj.allList")}</button>
      <button class="btn btn-ghost btn-sm" data-act="map">${window.Icon("map")} ${T("aj.onMap")}</button>
      <button class="btn btn-ghost btn-sm" data-act="again">${window.Icon("refresh")} ${T("aj.again")}</button>
    </div>`;
  }

  function bindActions() {
    $("#aiResult").querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => {
      const act = b.dataset.act;
      if (act === "list") { closeModal(); window.PetApp.showPage("results"); }
      else if (act === "map") { closeModal(); window.PetApp.showPage("map"); }
      else if (act === "again") askAgain();
    }));
  }

  /** 🔄 모달을 유지한 채 새 질문 받기 — 뒤로가기 없이 바로 재검색 */
  function askAgain() {
    setResult("");
    say(T("aj.askAgain"));
    const el = $("#aiInput2");
    if (el) { el.value = ""; el.focus(); }
  }

  /* ══════════ 견종 분류 ══════════
   * data/breeds.json = Gemini로 재분류한 표준 견종표(110종).
   *   소형견 10kg 미만 / 중형견 10 ~ 25kg / 대형견 25kg 이상
   * 표에 있으면 즉시 응답하고, 없는 품종만 Gemini에 물어본다. */
  const SIZE_KO = { small: "소형", medium: "중형", large: "대형" };
  let BREEDS = null, BREED_STD = null;

  function normKey(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/[\s\-_·.]/g, "");
  }

  /** 받침 유무에 따라 조사 선택 ("카디건은" / "시츄는") */
  function josa(word, withBatchim, without) {
    const w = String(word || "");
    const c = w.charCodeAt(w.length - 1);
    const hasBatchim = (c >= 0xAC00 && c <= 0xD7A3) ? (c - 0xAC00) % 28 !== 0 : true;
    return w + (hasBatchim ? withBatchim : without);
  }

  async function loadBreeds() {
    if (BREEDS) return BREEDS;
    try {
      const res = await fetch("data/breeds.json");
      const j = await res.json();
      BREED_STD = j.standard || null;
      BREEDS = (j.breeds || []).map(b => Object.assign({}, b, {
        _keys: [b.name].concat(b.aliases || []).map(normKey).filter(Boolean)
      }));
    } catch (_) {
      BREEDS = [];
    }
    return BREEDS;
  }

  /** 표준 견종표 조회
   *  ① 정확 일치 ② 입력으로 시작하는 이름 중 가장 짧은 것("포메"→포메라니안, 폼피츠 아님)
   *  ③ 입력이 이름을 포함("우리집골든리트리버") ④ 그 외 부분 일치 */
  function findBreed(q) {
    const k = normKey(q);
    if (!k || !BREEDS || !BREEDS.length) return null;
    let prefix = null, pLen = Infinity;   // key가 k로 시작 — 짧을수록 정확
    let inside = null, iLen = 0;          // k가 key를 포함 — 길수록 정확
    let loose = null, lLen = Infinity;    // 그 밖의 부분 일치 — 짧을수록 정확
    for (const b of BREEDS) {
      for (const key of b._keys) {
        if (key === k) return b;
        if (k.length < 2 || key.length < 2) continue;   // 한 글자는 정확 일치만
        if (key.indexOf(k) === 0) { if (key.length < pLen) { prefix = b; pLen = key.length; } }
        else if (k.indexOf(key) >= 0) { if (key.length > iLen) { inside = b; iLen = key.length; } }
        else if (key.indexOf(k) > 0) { if (key.length < lLen) { loose = b; lLen = key.length; } }
      }
    }
    return prefix || inside || loose;
  }

  async function classifyBreed(breed) {
    const box = $("#breedResult");
    const btn = $("#pfBreedBtn");
    box.classList.remove("hidden");
    box.innerHTML = `<span class="ai-spinner"></span> ${T("aj.analyzing", { b: escapeHtml(breed) })}`;
    btn.disabled = true;
    try {
      await loadBreeds();
      let d = findBreed(breed), src = T("aj.stdTable");
      if (d) {
        const range = BREED_STD ? BREED_STD[d.sizeClass] : "";
        d = Object.assign({}, d, {
          reply: window.I18N.isEn()
            ? T("aj.breedReply", { name: d.name, size: T("size." + d.sizeClass),
                unit: d.species === "cat" ? " cat" : " dog", range: range ? ` (${range})` : "" })
            : `${josa(d.name, "은", "는")} ${SIZE_KO[d.sizeClass]}${d.species === "cat" ? "묘" : "견"}이야` +
              `${range ? `(${range} 기준)` : ""}! 이 기준으로 갈 수 있는 곳을 골라 줄게 🐾`
        });
      } else {
        try {
          d = await callAI({ mode: "breed", breed }, 12000);
          src = T("aj.gemini");
        } catch (e) {
          // 표에 없는 품종인데 AI 도 못 답하면 — 오류 대신 몸무게로 정하는 길을 알려 준다
          console.warn("AI 품종 분류 실패:", e.code || e.message);
          box.innerHTML = T("aj.breedManual", { b: escapeHtml(breed) });
          const w = $("#pfWeight");
          if (w) w.focus({ preventScroll: true });
          return;
        }
      }
      const sizeLabel = window.I18N.isEn() ? T("size." + (d.sizeClass || "medium")) : (SIZE_KO[d.sizeClass] || "중형");
      const unit = window.I18N.isEn() ? (d.species === "cat" ? " cat" : " dog") : (d.species === "cat" ? "묘" : "견");
      box.innerHTML = `
        <b>${escapeHtml(d.name || breed)}</b> · ${sizeLabel}${unit} · ${escapeHtml(d.weightRange || (d.weightKg + "kg"))}
        ${d.dangerous ? ` <span class="badge badge-no">${T("aj.dangerous")}</span>` : ""}
        ${d.needMuzzle ? ` <span class="badge badge-cond">${T("aj.needMuzzle")}</span>` : ""}
        <span class="badge badge-verify">${escapeHtml(src)}</span>
        ${d.traits && d.traits.length ? `<div style="margin-top:6px;color:var(--ink-sub);">🐾 ${d.traits.map(escapeHtml).join(" · ")}</div>` : ""}
        ${d.travelTips && d.travelTips.length ? `<div style="margin-top:6px;">💡 ${d.travelTips.map(escapeHtml).join("<br>💡 ")}</div>` : ""}
        <div style="margin-top:8px;color:var(--ink);">${escapeHtml(d.reply || "")}</div>`;
      // 폼 자동 입력
      if (d.species) $("#pfSpecies").value = d.species === "cat" ? "cat" : (d.species === "other" ? "other" : "dog");
      if (d.weightKg) $("#pfWeight").value = d.weightKg;
      if (d.sizeClass) $("#pfSize").value = d.sizeClass;
      if (d.needMuzzle || d.dangerous) $("#pfMuzzle").checked = true;
      if (!$("#pfName").value.trim() && d.name) $("#pfName").placeholder = T("aj.nameExample", { name: d.name });
    } catch (e) {
      box.innerHTML = aiErrorMsg(e);
    } finally {
      btn.disabled = false;
    }
  }

  /* ══════════ 유틸 ══════════ */
  function aiErrorMsg(e) {
    if (e.code === "NO_KEY") return T("aj.noKey");
    return `${T("aj.err")}<span style="color:var(--ink-sub);font-size:12px;">${escapeHtml(e.message || "")}</span>`;
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }

  window.PetAI = {
    ask, askAgain, classifyBreed, findBreed, loadBreeds,
    placeInfo, stars, GMap, Route, openModal, closeModal, say, MASCOT
  };
})();
