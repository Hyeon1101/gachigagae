/* ─────────────────────────────────────────────────────────────
 * 같이가개 메인 앱 로직
 * 데이터: TourAPI 「반려동물 동반여행 서비스」(Netlify Function 프록시)
 *         → 키 미설정/실패 시 data/sample.json 데모 데이터 폴백
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  const CFG = window.PETMAP_CONFIG;
  const R = window.PetRules;
  const $ = (s) => document.querySelector(s);

  const T = (k, v) => window.T(k, v);

  /* ─── 🛡️ 화면에 넣기 전 한 번 거르는 자리 ───────────────────────
   * 여기 들어오는 글의 상당수는 우리가 쓴 글이 아니다. 장소명·주소·전화·
   * 시설 안내는 공공데이터에 등록한 사람이, 평점 옆 후기 본문은 네이버에
   * 글을 남긴 아무 이용자가 쓴 것이다. 그대로 innerHTML 에 넣으면 남이 쓴
   * 글이 우리 화면에서 코드로 실행된다(저장형 XSS).
   *   esc     : 본문·속성값 공용 (따옴표까지 막아 속성 밖으로 못 나가게)
   *   safeUrl : src/href 용 — http(s)·상대경로·이미지 data URI 만 통과
   * ※ T(...) 번역문과 window.Icon(...) 은 우리가 쓴 마크업이므로 그대로 둔다. */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function safeUrl(u) {
    const s = String(u == null ? "" : u).trim();
    return /^(https?:\/\/|\/|\.\/|data:image\/)/i.test(s) ? esc(s) : "";
  }

  const TYPE_EMOJI = { "39": "🍽️", "12": "🏞️", "32": "🏨", "14": "🏛️", "28": "⚽", "38": "🛍️", "15": "🎪" };
  /* 지역·카테고리·판정 라벨은 언어에 따라 달라진다 → 호출 시점에 번역한다 */
  const AREA_CODES = ["", "1", "31", "2", "32", "33", "34", "35", "36", "37", "38", "39", "3", "4", "5", "6", "7", "8"];
  const areaName = (code) => T("area." + (code || ""));
  const typeName = (type) => T("type." + type);
  const statusLabel = (s) => T("st." + s);
  /* 문화정보원 데이터의 '시도 명칭' 표기 (정확히 일치해야 서버 필터가 걸린다) */
  const SIDO_NAME = {
    "1": "서울특별시", "2": "인천광역시", "3": "대전광역시", "4": "대구광역시", "5": "광주광역시",
    "6": "부산광역시", "7": "울산광역시", "8": "세종특별자치시", "31": "경기도", "32": "강원특별자치도",
    "33": "충청북도", "34": "충청남도", "35": "경상북도", "36": "경상남도",
    "37": "전북특별자치도", "38": "전라남도", "39": "제주특별자치도"
  };
  const STATUS_KEY = { ok: "check", cond: "warn", no: "ban", unknown: "help" };
  const SI = (s) => window.Icon(STATUS_KEY[s] || "help");   // 판정 아이콘(SVG)

  /* 🏠 홈 대시보드 카탈로그 — 전국 등록 건수(2026-07 실측) */
  const CATALOG = [
    {
      group: "한국관광공사 TourAPI", total: 9764, alt: false,
      items: [
        { type: "39", emoji: "🍽️", total: 75 },
        { type: "12", emoji: "🏞️", total: 766 },
        { type: "38", emoji: "🛍️", total: 8654 },
        { type: "32", emoji: "🏨", total: 163 },
        { type: "28", emoji: "⚽", total: 81 },
        { type: "14", emoji: "🏛️", total: 25 }
      ]
    },
    {
      group: "한국문화정보원", total: 70650, alt: true,
      items: [
        { type: "culture:medical", emoji: "🏥", total: 58778 },
        { type: "culture:service", emoji: "🛁", total: 8276 },
        { type: "culture:trip", emoji: "✈️", total: 2742 },
        { type: "culture:cafe", emoji: "☕", total: 853 }
      ]
    }
  ];
  const metaOf = (type) => CATALOG.flatMap(g => g.items).find(i => i.type === type);
  // 행안부 동물병원: 엑셀 전수조사 결과 실제로 없는 행정구역(전남광주통합특별시 371 +
  // 인천 서해구 35) 406곳을 삭제해 5,038곳 (2026-08-04)
  const GRAND_TOTAL = 9764 + 70650 + 5038;

  const state = {
    adapter: null,
    places: [],            // 현재 목록 (정규화됨)
    samples: null,         // 샘플 전체 캐시
    petCache: {},          // contentid → pet 규정 (live)
    selected: null,
    profile: loadProfile(),
    contentType: "39",
    area: "1",
    keyword: "",
    fitOnly: false,
    favMode: false,        // ❤️ 목록을 「즐겨찾기」로 갈아 끼운 상태
    demoMode: false,
    totalCount: 0,
    profileVersion: 0,  // 판정 캐시 무효화 키
    reqSeq: 0,          // 로드 요청 일련번호(탭 빠른 전환 시 경합 방지)
    listLimit: 250,
    vets: null,         // 동물병원 캐시 (최초 상세 열람 시 1회 로드)
    vetError: null,
    page: "home",       // "home" | "results" | "map"
    realCounts: {},     // type → {ok, loaded, area} — 마스코트가 채워 넣는 실제 수
    aiPicks: []         // AI가 추천한 장소 id
  };

  /* ══════════ 데이터 계층 ══════════ */

  /* 관광공사 대표이미지는 일부가 http:// 로 내려온다(실측 9,694건 중 446건).
   * https 사이트에서는 혼합 콘텐츠로 차단돼 사진이 통째로 안 뜬다
   * — 숙박은 이미지가 있는 38곳이 전부 http라 화면상 0장이었다.
   * 같은 경로가 https 로도 서비스되므로 올려 준다. */
  function httpsImg(u) {
    return String(u || "").replace(/^http:\/\//i, "https://");
  }

  function normalizeItem(it, extra = {}) {
    const p = {
      id: String(it.contentid),
      title: it.title || "(이름 없음)",
      addr: [it.addr1, it.addr2].filter(Boolean).join(" "),
      tel: it.tel || "",
      lat: parseFloat(it.mapy),
      lng: parseFloat(it.mapx),
      img: httpsImg(it.firstimage || it.firstimage2 || ""),
      type: String(it.contenttypeid || ""),
      areacode: String(it.areacode || ""),
      pet: it.pet || null,
      verified: it.verified === true,
      source: it.source || "한국관광공사 TourAPI",
      // 문화정보원 부가 필드 (있을 때만)
      _hours: it._hours, _holiday: it._holiday, _category: it._category,
      _parking: it._parking, _fee: it._fee, _petFee: it._petFee,
      _desc: it._desc, _indoor: it._indoor, _outdoor: it._outdoor,
      ...extra
    };
    // 좌표 검수 — 틀린 좌표는 여기서 교정되거나 suspect로 표시된다.
    // (suspect면 길안내는 이름+주소 검색으로 가고 지도 마커에서는 빠진다)
    p._geo = window.PetGeo ? window.PetGeo.verify(p) : "ok";
    return p;
  }

  async function fetchLiveBody(params) {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(window.API(`/api/pettour?${q}`));
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    const body = json.response && json.response.body;
    if (!body) throw new Error("BAD_RESPONSE");
    let items = body.items && body.items.item ? body.items.item : [];
    if (!Array.isArray(items)) items = [items];
    return { items, total: parseInt(body.totalCount, 10) || items.length };
  }

  async function fetchLive(params) {
    return (await fetchLiveBody(params)).items;
  }

  /** 전체 페이지 수집 (전량 출력).
   *  TourAPI는 건당 약 34ms가 걸려 순차 요청 시 8,654건에 5분 이상 걸린다.
   *  → 1페이지로 총건수를 파악한 뒤 나머지를 병렬(동시 4개)로 받아 시간을 1/4로 줄인다.
   *  onPage 콜백으로 도착하는 대로 화면에 반영한다. */
  async function fetchAllPages(baseParams, onPage) {
    const PAGE_SIZE = 500, CONCURRENCY = 4, MAX_PAGES = 40;

    const first = await fetchLiveBody({ ...baseParams, numOfRows: PAGE_SIZE, pageNo: 1 });
    const total = first.total;
    const pages = Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES);
    const buckets = new Array(pages);
    buckets[0] = first.items;
    if (onPage) onPage(first.items.slice(), total);
    if (pages <= 1) return { items: first.items, total };

    const queue = [];
    for (let p = 2; p <= pages; p++) queue.push(p);

    const flatten = () => {
      const out = [];
      for (const b of buckets) if (b) out.push(...b);   // 도착한 페이지만, 순서 유지
      return out;
    };

    async function worker() {
      while (queue.length) {
        const p = queue.shift();
        try {
          const r = await fetchLiveBody({ ...baseParams, numOfRows: PAGE_SIZE, pageNo: p });
          buckets[p - 1] = r.items;
        } catch (_) {
          buckets[p - 1] = [];          // 개별 페이지 실패는 건너뛴다
        }
        if (onPage) onPage(flatten(), total);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    return { items: flatten(), total };
  }

  async function loadSamples() {
    if (!state.samples) {
      const res = await fetch("data/sample.json");
      state.samples = await res.json();
    }
    return state.samples;
  }

  /** 목록 로드: live 시도 → 실패 시 샘플 */
  async function loadPlaces() {
    let items = null;
    // 좌표 기준표(9KB)는 첫 정규화 전에 한 번만 받는다. 두 번째부터는 즉시 반환.
    if (window.PetGeo) await window.PetGeo.load();
    resetRateBudget();
    state.demoMode = false;
    state.listLimit = LIST_STEP;
    state.fitPending = true;   // 새 목록의 첫 렌더에서만 지도 범위 조정
    const listEl = $("#placeList");
    if (listEl) listEl.innerHTML = `<div class="empty-note">${T("res.loading")}</div>`;
    // 🐾 문화정보원 반려동물 시설 (별도 공공데이터) — "culture:trip" 형태
    if (state.contentType.startsWith("culture")) {
      try {
        const catKey = state.contentType.split(":")[1] || "trip";
        const sido = SIDO_NAME[state.area] || "";
        const reqId = ++state.reqSeq;
        // 정규화 결과를 id로 캐시 — 이미 만든 객체를 재사용해 판정 캐시까지 보존
        const normCache = new Map();
        const normAll = (rows) => rows.map(it => {
          const k = String(it.contentid);
          let n = normCache.get(k);
          if (!n) { n = normalizeItem(it); normCache.set(k, n); }
          return n;
        });
        const r = await Extra.loadCulture({
          catKey, sido,
          onPage: (partial, total) => {
            if (reqId !== state.reqSeq) return;
            state.totalCount = total || partial.length;
            state.places = normAll(partial);
            renderThrottled();
          }
        });
        if (reqId !== state.reqSeq) return;
        state.places = normAll(r.items);
        state.totalCount = r.matched || state.places.length;
        state.demoMode = false;
        updateDemoBanner();
        renderAll();
        recordRealCount();   // 🐶 마스코트가 실제 가능 수를 채워 넣는다
      } catch (e) {
        const info = e.info || {};
        state.places = [];
        state.totalCount = 0;
        renderCount([]);
        $("#placeList").innerHTML = `<div class="empty-note" style="text-align:left;line-height:1.6;">
          ${T("ex.noData")}<br><br>
          ${esc(info.hint || e.message)}<br><br>
          ${T("ex.how")}<br>
          ① <a href="${safeUrl(info.applyUrl) || "https://www.data.go.kr/data/15111389/fileData.do"}" target="_blank" rel="noopener" style="color:var(--blue);">${T("ex.step1")}</a>${T("ex.step1s")}<br>
          ${T("ex.step2")}<br>
          <span style="color:var(--ink-sub);font-size:12px;">${T("ex.step3")}</span>
        </div>`;
        if (state.adapter) state.adapter.clearMarkers();
      }
      return;
    }

    if (CFG.USE_LIVE_API) {
      try {
        const params = { op: "areaBasedList", contentTypeId: state.contentType, arrange: "O" };
        if (state.area) params.areaCode = state.area;   // 빈 값 = 전국
        const reqId = ++state.reqSeq;                   // 탭 전환 중 이전 요청 결과 무시
        // 전 페이지 수집 — 도착하는 대로 화면 반영(점진 표시)
        // 병렬 수집이라 중간 페이지가 나중에 채워질 수 있으므로 id 캐시로 재사용한다
        // (같은 객체를 유지해야 판정 캐시도 살아남는다)
        const normCache = new Map();
        const normAll = (rows) => rows.map(it => {
          const k = String(it.contentid);
          let n = normCache.get(k);
          if (!n) { n = normalizeItem(it); normCache.set(k, n); }
          return n;
        });
        const r = await fetchAllPages(params, (partial, total) => {
          if (reqId !== state.reqSeq) return;
          state.totalCount = total;
          state.places = normAll(partial);
          renderThrottled();
        });
        if (reqId !== state.reqSeq) return;
        items = r.items;
        state.totalCount = r.total;
        state.places = normAll(items);
        prefetchPetInfo(state.places.slice(0, 15));
      } catch (e) {
        console.warn("TourAPI 연결 실패 → 데모 데이터 사용:", e.message);
        items = null;
      }
    }
    if (items === null) {
      state.demoMode = true;
      const all = await loadSamples();
      state.places = all
        .filter(it => String(it.contenttypeid) === state.contentType)
        .map(it => normalizeItem(it, { source: it.source || "데모 데이터(현장 확인 전)" }));
      state.totalCount = state.places.length;
    }
    updateDemoBanner();
    renderAll();
    recordRealCount();   // 🐶 마스코트가 실제 가능 수를 채워 넣는다
  }

  /** live 모드: 반려동물 규정 상세를 앞쪽 N건 미리 조회 */
  async function prefetchPetInfo(list) {
    await Promise.allSettled(list.map(async (p) => {
      if (state.petCache[p.id]) { p.pet = state.petCache[p.id]; return; }
      try {
        const items = await fetchLive({ op: "detailPetTour", contentId: p.id });
        if (items[0]) { p.pet = items[0]; state.petCache[p.id] = items[0]; }
      } catch (_) { /* 개별 실패 무시 */ }
    }));
    renderAll();
  }

  async function getPetInfo(place) {
    if (place.pet) return place.pet;
    if (state.demoMode) return null;
    if (state.petCache[place.id]) { place.pet = state.petCache[place.id]; return place.pet; }
    try {
      const items = await fetchLive({ op: "detailPetTour", contentId: place.id });
      if (items[0]) { place.pet = items[0]; state.petCache[place.id] = items[0]; }
    } catch (_) {}
    return place.pet;
  }

  /* ══════════ 판정/뱃지 ══════════ */

  /* 판정 결과 메모이제이션 — parseRules는 정규식 25개를 돌리므로
   * 목록·정렬·카운터·마커가 같은 장소를 반복 판정하면 급격히 느려진다.
   * 프로필이 바뀔 때만 캐시를 무효화한다(profileVersion). */
  function verdictOf(place) {
    if (place._v && place._vVer === state.profileVersion) return place._v;
    const rules = R.parseRules(place.pet);
    const v = { rules, ...R.judge(state.profile, rules) };
    place._v = v;
    place._vVer = state.profileVersion;
    return v;
  }

  function ruleBadges(rules) {
    if (!rules.known) return `<span class="badge badge-unknown">${T("rb.none")}</span>`;
    const b = [];
    if (rules.weightLimitKg != null) b.push(T("rb.weight", { n: rules.weightLimitKg }));
    if (rules.allowedSizes.length) b.push(T("rb.sizes", { s: rules.allowedSizes.map(s => R.SIZE_LABEL[s]).join("·") }));
    if (rules.leashRequired) b.push(T("rb.leash"));
    if (rules.cageRequired) b.push(T("rb.cage"));
    if (rules.muzzleRequired) b.push(T("rb.muzzle"));
    if (rules.outdoorOnly || rules.indoorBanned) b.push(T("rb.outdoor"));
    if (rules.vaccineRequired) b.push(T("rb.vaccine"));
    return b.slice(0, 4).map(t => `<span class="badge badge-rule">${t}</span>`).join("");
  }

  /* ══════════ 렌더링 ══════════ */

  /** 목록의 재료 — 평소엔 불러온 장소, 즐겨찾기 모드면 저장해 둔 곳.
   *  저장본은 이미 정규화된 복사본이라 그대로 카드·지도·상세에 쓸 수 있다. */
  function sourcePlaces() {
    if (!state.favMode) return state.places;
    return (window.PetFav ? window.PetFav.list() : []).map(p => Object.assign({}, p));
  }

  /** ❤️ 즐겨찾기 목록 화면 — 저장한 곳을 평소 목록 UI 그대로 보여 준다.
   *  팝오버는 빠르게 훑는 용도이고, 이쪽은 검색·지도·상세까지 다 되는 본 화면이다. */
  function showFavorites() {
    state.favMode = true;
    state.selected = null;
    state.keyword = "";
    state.listLimit = LIST_STEP;
    const si = $("#searchInput"); if (si) si.value = "";
    $("#detailPanel").classList.add("hidden");
    syncFavMode();
    showPage("results");
    renderAll();
  }

  /** 즐겨찾기 모드일 때 목록 화면의 제목·도구를 바꿔 끼운다 */
  function syncFavMode() {
    const on = !!state.favMode;
    const title = $("#resultTitle");
    if (title) {
      title.textContent = on ? T("fav.title")
        : (metaOf(state.contentType) ? typeName(state.contentType) : T("res.title"));
    }
    const back = $("#favBackBtn");
    if (back) back.classList.toggle("hidden", !on);
    // 지역·카테고리 도구는 저장 목록에 의미가 없다 — 헷갈리지 않게 감춘다
    ["#areaSelect", "#reSearchBtn"].forEach(sel => {
      const n = $(sel); if (n) n.classList.toggle("hidden", on);
    });
    const results = $("#pageResults");
    if (results) results.classList.toggle("fav-mode", on);
  }

  function visiblePlaces() {
    let list = sourcePlaces().filter(p => !isNaN(p.lat) && !isNaN(p.lng));
    if (state.keyword) {
      const k = state.keyword.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(k) || p.addr.toLowerCase().includes(k));
    }
    if (state.fitOnly && state.profile) {
      list = list.filter(p => {
        const v = verdictOf(p);
        return v.status === "ok" || v.status === "cond";
      });
    }
    // 입장 가능한 곳을 위로 (헛걸음 방지 서비스의 기본 정렬)
    const ORDER = { ok: 0, cond: 1, unknown: 2, no: 3 };
    return list
      .map(p => ({ p, s: ORDER[verdictOf(p).status] })).sort((a, b) => a.s - b.s)
      .map(x => x.p);
  }

  /** 렌더 스로틀 — 대량 로딩 중 매 페이지마다 전체 렌더하면 화면이 멈춘다 */
  let renderTimer = null, lastRenderAt = 0;
  function renderThrottled(minGapMs = 700) {
    const now = Date.now();
    if (now - lastRenderAt >= minGapMs) {
      lastRenderAt = now;
      renderAll();
      return;
    }
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => { lastRenderAt = Date.now(); renderAll(); }, minGapMs);
  }

  const LIST_STEP = 60;     // 목록 1회 렌더 수 (더보기로 추가) — 첫 화면을 빠르게
  const MARKER_CAP = 800;   // 지도 마커 상한 (성능 보호)
  const SIMPLE_MARKER_FROM = 150;  // 이 개수를 넘으면 경량 원형 마커로 전환

  /* ══════════ 🏠 홈 대시보드 ══════════ */

  function mascotSrc() {
    return (localStorage.getItem("petmap_helper_kind") || "dog") === "cat"
      ? "assets/helper_cat.png" : "assets/helper_dog.png";
  }

  /** 마스코트 대사 — 홈 히어로 말풍선(AI 모달이 열려 있으면 그쪽)
   *  AI 검색이 진행 중일 때는 AI 답변을 덮어쓰지 않는다 */
  function mascotSay(html) {
    if (state.aiBusy) return;
    if (!$("#aiModal").classList.contains("hidden")) { window.PetAI.say(html); return; }
    /* 앱에서는 홈 아래쪽 안내 스트립을 없앴다(너무 밑이라 안 보였다).
     * 대신 화면을 따라다니는 도우미가 그 자리에서 가로로 말해 준다. */
    const CFG = window.PETMAP_CONFIG || {};
    if (CFG.IS_NATIVE_APP && window.PetBuddy && window.PetBuddy.say) {
      window.PetBuddy.say(html);
      return;
    }
    const b = $("#heroBubble");
    if (!b) return;
    b.innerHTML = html;
    b.style.animation = "none"; void b.offsetWidth; b.style.animation = "";
  }

  /** 홈: 카테고리 버튼 그리드 + 내 반려동물 박스 */
  function renderHome() {
    const grid = $("#catGrid");
    if (grid) {
      grid.innerHTML = CATALOG.flatMap(g => g.items.map(it => {
        const r = state.realCounts[it.type];
        return `<button class="cat-btn${g.alt ? " alt" : ""}" data-go="${it.type}">
          <span class="cat-ic">${window.Icon.cat(it.type)}</span>
          <span class="cat-name">${typeName(it.type)}</span>
          <span class="cat-total">${T("cat.count", { n: it.total.toLocaleString() })}</span>
          ${r ? `<span class="cat-real"><img src="${mascotSrc()}" alt="">${T("cat.able", { n: r.ok.toLocaleString() })}</span>` : ""}
        </button>`;
      })).join("");
      grid.querySelectorAll(".cat-btn").forEach(c =>
        c.addEventListener("click", () => goCategory(c.dataset.go)));
    }
    renderAreaRail();
    renderPetForm();
    window.PetTips.renderInfo(summary());
    // 전체 건수는 히어로·카테고리 두 곳에 나오므로 id 대신 data 속성으로 모두 채운다
    document.querySelectorAll("[data-grand]").forEach(el => {
      el.textContent = GRAND_TOTAL.toLocaleString();
    });
    const hm = $("#heroMascot");
    if (hm) hm.src = mascotSrc();
  }

  /** 🐶 홈 상단 반려동물 카드 — 저장된 값을 폼에 채우고 상태 배지를 갱신 */
  function renderPetForm() {
    const p = state.profile;
    const st = $("#pfState");
    const av = $("#pfAvatar");
    if (p) {
      if ($("#pfName")) $("#pfName").value = p.name === "내 반려동물" ? "" : p.name;
      if ($("#pfSpecies")) $("#pfSpecies").value = p.species;
      if ($("#pfWeight")) $("#pfWeight").value = p.weightKg;
      if ($("#pfSize")) $("#pfSize").value = p.size;
      if ($("#pfLeash")) $("#pfLeash").checked = p.hasLeash;
      if ($("#pfCage")) $("#pfCage").checked = p.hasCage;
      if ($("#pfMuzzle")) $("#pfMuzzle").checked = p.hasMuzzle;
      if ($("#pfVaccine")) $("#pfVaccine").checked = p.vaccinated;
      const size = p.size === "auto" ? R.sizeFromWeight(p.weightKg) : p.size;
      if (st) {
        st.textContent = `${p.name} · ${R.SIZE_LABEL[size]}${T("unit.dog")} ${p.weightKg}kg`;
        st.classList.add("on");
      }
      if (av) av.innerHTML = `<img class="pet-logo md" src="assets/helper_${p.species === "cat" ? "cat" : "dog"}.png" alt="">`;
    } else {
      if (st) { st.textContent = T("pf.stateEmpty"); st.classList.remove("on"); }
      if (av) av.innerHTML = window.Icon.logo("md");
    }
  }

  /* ══════════ 📍 지역 바꾸기 ══════════
   * 예전에는 「목록」 화면의 셀렉트 박스가 유일한 통로였다.
   * → ① 상단바 지역 버튼(어느 화면에서든) ② 홈의 지역 칩 레일
   *   ③ 맨 아래 핫플레이스의 지역 버튼 — 세 곳 모두 이 함수로 모인다. */
  function setArea(code, opts) {
    const o = opts || {};
    const next = String(code == null ? "" : code);
    const changed = next !== state.area;
    state.area = next;
    const sel = $("#areaSelect");
    if (sel) sel.value = next;
    syncAreaUI();
    if (!changed && !o.force) return;
    state.realCounts = {};                    // 지역이 바뀌면 실제 수는 다시 세야 한다
    document.dispatchEvent(new CustomEvent("petmap:area", { detail: { area: next } }));
    // 이미 카테고리를 보고 있으면 곧바로 다시 불러온다(목록·지도 동시 반영)
    if (state.places.length || state.page === "results" || state.page === "map") loadPlaces();
    else window.PetTips.renderInfo(summary());
    if (o.say !== false) mascotSay(T("region.done", { area: areaName(next) }));
  }

  /** 지역 표시(상단 버튼·칩·핫플레이스)를 현재 값으로 맞춘다 */
  function syncAreaUI() {
    const nm = $("#regionBtnName");
    if (nm) nm.textContent = areaName(state.area);
    document.querySelectorAll("#areaRail .area-chip, #regionPopGrid .area-chip").forEach(b =>
      b.classList.toggle("on", (b.dataset.area || "") === state.area));
  }

  /** 홈 지역 칩 레일 + 상단바 팝오버 그리드 */
  function renderAreaRail() {
    const html = AREA_CODES.map(c =>
      `<button type="button" class="area-chip${c === state.area ? " on" : ""}" data-area="${c}">${areaName(c)}</button>`).join("");
    const rail = $("#areaRail");
    if (rail) {
      rail.innerHTML = `<span class="area-rail-label">${T("region.now")}</span>` + html;
      rail.querySelectorAll(".area-chip").forEach(b =>
        b.addEventListener("click", () => setArea(b.dataset.area)));
    }
    const pop = $("#regionPopGrid");
    if (pop) {
      pop.innerHTML = html;
      pop.querySelectorAll(".area-chip").forEach(b =>
        b.addEventListener("click", () => { setArea(b.dataset.area); toggleRegionPop(false); }));
    }
    syncAreaUI();
  }

  /** 📏 좁은 화면에서는 상단바가 두 줄로 접힌다 — 실제 높이를 재서 본문 시작 위치에 반영한다
   *  (지역·언어 버튼이 늘어난 뒤 고정값 104px로는 본문이 상단바에 가렸다) */
  function syncTopbarHeight() {
    const bar = document.querySelector(".topbar");
    if (!bar) return;
    if (window.innerWidth <= 640) {
      document.documentElement.style.setProperty("--topbar-h", Math.ceil(bar.getBoundingClientRect().height) + "px");
    } else {
      document.documentElement.style.removeProperty("--topbar-h");
    }
  }

  function toggleRegionPop(force) {
    const pop = $("#regionPop"), btn = $("#regionBtn");
    if (!pop) return;
    const open = force !== undefined ? force : pop.classList.contains("hidden");
    pop.classList.toggle("hidden", !open);
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  /** 프로필 카드로 이동 (상단 「내 반려동물」 버튼) */
  function openProfile() {
    showPage("home");
    const card = $("#petForm");
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.remove("flash");
    void card.offsetWidth;
    card.classList.add("flash");
    const nm = $("#pfBreed");
    if (nm) setTimeout(() => nm.focus({ preventScroll: true }), 350);
  }

  /** 🔄 검색 초기화 — 검색어·필터·AI 추천을 지우고 처음 상태로
   *  (지금까지는 브라우저 뒤로가기로만 되돌릴 수 있었다) */
  function resetSearch(opts) {
    const o = opts || {};
    state.keyword = "";
    state.fitOnly = false;
    state.aiPicks = [];
    state.selected = null;
    state.listLimit = LIST_STEP;
    const si = $("#searchInput"); if (si) si.value = "";
    const fo = $("#fitOnly"); if (fo) fo.checked = false;
    const ai = $("#aiInput"); if (ai) ai.value = "";
    const ai2 = $("#aiInput2"); if (ai2) ai2.value = "";
    $("#detailPanel").classList.add("hidden");
    if (o.toHome) {
      state.realCounts = {};
      window.PetAI.closeModal();
      showPage("home");
      mascotSay(T("ms.reset"));
    }
    renderAll();
  }

  /** 카테고리 진입 */
  /** 📥 AI 모달을 아래로 끌어내려 닫기.
   *
   *  손잡이(#aiGrab)를 잡고 내리면 카드가 손가락을 따라오고, 충분히 내려가면 닫힌다.
   *  모자라면 제자리로 돌아간다 — "무엇을 하면 닫히는지"가 눈에 보여야 하므로
   *  손잡이에는 안내 문구도 같이 붙였고, 그냥 눌러도 닫힌다. */
  function bindModalDragClose() {
    const grab = $("#aiGrab"), card = document.querySelector("#aiModal .ai-card");
    if (!grab || !card) return;
    const CLOSE_AT = 90;                 // 이만큼 내려가면 닫는다(px)
    let startY = null, dy = 0, moved = false;

    const move = (y) => {
      dy = Math.max(0, y - startY);
      moved = moved || dy > 4;
      card.style.transition = "none";
      card.style.transform = `translateY(${dy}px)`;
      card.style.opacity = String(Math.max(0.55, 1 - dy / 420));
    };
    const end = () => {
      if (startY === null) return;
      const close = dy > CLOSE_AT;
      startY = null;
      card.style.transition = "";
      card.style.transform = "";
      card.style.opacity = "";
      if (close) window.PetAI.closeModal();
      else if (!moved) window.PetAI.closeModal();   // 끌지 않고 눌렀다 = 닫기 버튼
      dy = 0; moved = false;
    };

    grab.addEventListener("pointerdown", (e) => {
      startY = e.clientY; dy = 0; moved = false;
      try { grab.setPointerCapture(e.pointerId); } catch (_) {}
    });
    grab.addEventListener("pointermove", (e) => { if (startY !== null) move(e.clientY); });
    grab.addEventListener("pointerup", end);
    grab.addEventListener("pointercancel", end);
    // 포인터 이벤트가 없는 환경 대비 — 키보드로도 닫힌다
    grab.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.PetAI.closeModal(); }
    });
  }

  function goCategory(type) {
    state.favMode = false;              // 카테고리를 고르면 즐겨찾기 목록에서 빠져나온다
    syncFavMode();
    state.contentType = type;
    state.selected = null;
    $("#detailPanel").classList.add("hidden");
    $("#resultTitle").textContent = metaOf(type) ? typeName(type) : T("res.title");
    $("#mapTitle").textContent = metaOf(type) ? typeName(type) : T("map.title");
    showPage("results");
    loadPlaces();
  }

  /** 페이지 전환: home | results | map
   *  fromPop=true 면 뒤로가기로 들어온 것이라 history를 다시 쌓지 않는다 */
  function showPage(name, fromPop) {
    if (!fromPop && state.page !== name) {
      try { history.pushState({ page: name }, "", "#" + name); } catch (_) {}
    }
    state.page = name;
    ["home", "results", "map", "tips"].forEach(n =>
      $("#page" + n[0].toUpperCase() + n.slice(1)).classList.toggle("hidden", n !== name));
    document.querySelectorAll(".nav-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.page === name));
    if (name === "home") renderHome();
    if (name === "tips") {
      const m = window.PetTips.mascot();
      if (m) m.src = window.Icon.mascotSrc();
    }
    if (name === "map") {
      if (!state.adapter) return;
      // 숨겨진 상태로 만들어진 지도는 크기를 다시 잡아 줘야 한다
      setTimeout(() => {
        state.adapter.invalidate && state.adapter.invalidate();
        state.fitPending = true;
        renderMarkers(visiblePlaces());
      }, 60);
    }
  }

  /** 🐶 마스코트가 실제 가능 수를 채워 넣는다 */
  function recordRealCount() {
    const list = state.places;
    if (!list.length) return;
    // 문화정보원: 목록에 규정이 함께 옴 → 정밀 집계
    // TourAPI: 「반려동물 동반여행 서비스」 수록 자체가 동반 가능 장소이고 세부 규정은 상세에서 옴
    //          → 규정 미조회분(unknown)도 동반 가능으로 집계한다
    const isCulture = state.contentType.startsWith("culture");
    let ok = 0, cond = 0, no = 0, unknown = 0;
    for (const p of list) {
      const s = verdictOf(p).status;
      if (s === "ok") ok++;
      else if (s === "cond") cond++;
      else if (s === "no") no++;
      else unknown++;
    }
    const able = isCulture ? ok + cond : ok + cond + unknown;
    state.realCounts[state.contentType] = { ok: able, loaded: list.length, no, area: state.area };
    window.PetTips.renderInfo(summary());   // 홈 오른쪽 요약 카드 갱신

    const head = T("ms.head", {
      area: areaName(state.area),
      cat: metaOf(state.contentType) ? typeName(state.contentType) : T("type.none"),
      n: list.length.toLocaleString()
    });
    const vars = { head, able: able.toLocaleString(), no: no.toLocaleString() };
    if (isCulture) {
      mascotSay(T(state.profile ? "ms.cultureProfile" : "ms.cultureNoProfile", vars));
    } else {
      mascotSay(T("ms.tour", vars));
    }
  }

  function renderAll() {
    const list = visiblePlaces();
    renderCount(list);
    renderList(list);
    renderMarkers(list);
  }

  function renderCount(list) {
    const el = $("#countInfo");
    if (!el) return;
    if (state.favMode) {                      // 즐겨찾기 목록은 "몇 곳 저장" 하나면 충분하다
      el.innerHTML = T("fav.count", { n: list.length.toLocaleString() });
      return;
    }
    const total = state.totalCount || list.length;
    let txt = T("res.registered", { n: total.toLocaleString() });
    if (state.places.length < total) txt += T("res.loadingMore", { n: state.places.length.toLocaleString() });
    if (list.length !== state.places.length) txt += T("res.filtered", { n: list.length.toLocaleString() });
    // 동반 가능/불가 요약 — 단일 순회(리스트를 두 번 훑지 않는다)
    let okN = 0, noN = 0;
    for (const p of list) {
      const s = verdictOf(p).status;
      if (s === "ok" || s === "cond") okN++;
      else if (s === "no") noN++;
    }
    if (noN > 0) {
      txt += ` <span class="cnt-ok">${T("res.okCount", { n: okN.toLocaleString() })}</span>` +
             ` / <span class="cnt-no">${T("res.noCount", { n: noN.toLocaleString() })}</span>`;
    }
    el.innerHTML = txt;
  }

  function renderList(list) {
    const el = $("#placeList");
    if (!list.length) {
      el.innerHTML = `<div class="empty-note">${T("res.empty")}</div>`;
      return;
    }
    const shown = list.slice(0, state.listLimit || LIST_STEP);
    el.innerHTML = shown.map(p => {
      const v = verdictOf(p);
      const sel = state.selected && state.selected.id === p.id ? " selected" : "";
      const verify = state.demoMode
        ? `<span class="badge badge-verify">${T(p.verified ? "rb.verified" : "rb.sample")}</span>`
        : `<span class="badge badge-verify">${T("rb.official")}</span>`;
      // 사진: 공공데이터 대표이미지 → 없으면 네이버 플레이스 실사진(이미 받아 둔 것)
      // → 그래도 없으면 카테고리 이모지. data-photo 자리는 평점 조회가 끝나면 채워진다.
      const shot = safeUrl(p.img || (p._naver && p._naver.thumb) || "");
      // 사진이 깨지면 이모지 상자로 되돌린다 — 예전엔 onerror 안에 장소 id(=이름 포함)를
      // 그대로 심었다. 이름에 따옴표 하나만 있어도 그 자리가 코드가 된다.
      // → 실패 처리는 config.js 의 공용 처리기(data-imgfail)로 넘긴다.
      const thumb = shot
        ? `<img class="pc-thumb" data-photo="${esc(p.id)}" src="${shot}" alt="" loading="lazy" decoding="async"
                data-imgfail="${esc(TYPE_EMOJI[p.type] || "📍")}">`
        : `<div class="pc-thumb" data-photo="${esc(p.id)}">${esc(TYPE_EMOJI[p.type] || "📍")}</div>`;
      const pick = state.aiPicks.includes(String(p.id)) ? " ai-pick" : "";
      // ❤️ 사진 위 오른쪽 위 — 카드 클릭(상세)과 겹치지 않게 favorites.js 가 클릭을 가로챈다
      const fav = window.PetFav ? window.PetFav.button(p.id, "pc-fav") : "";
      return `<div class="place-card${sel}${pick}" data-id="${esc(p.id)}">
        ${fav}
        <div class="pc-row">
          ${thumb}
          <div class="pc-main">
            <div class="pc-top">
              <div class="pc-title">${esc(p.title)}</div>
              <span class="badge badge-${esc(v.status)}">${SI(v.status)} ${statusLabel(v.status)}</span>
            </div>
            <div class="pc-rate" data-rate="${esc(p.id)}"></div>
            <div class="pc-addr">${window.Icon("pin")}<span>${p.addr ? esc(p.addr) : T("dt.noAddr")}</span></div>
            <div class="pc-rules">${ruleBadges(v.rules)} ${verify}</div>
          </div>
        </div>
        <div class="pc-btns">
          <a class="pc-btn primary" target="_blank" rel="noopener" data-stop
             href="${safeUrl(window.PetAI.Route.kakao(p))}">${window.Icon("route")} ${T("dt.routeKakao")}</a>
          <button type="button" class="pc-btn" data-detail="${esc(p.id)}">${window.Icon("info")} ${T("dt.detailRule")}</button>
        </div>
      </div>`;
    }).join("") + (list.length > shown.length
      ? `<button class="btn btn-ghost" id="loadMoreBtn" style="margin:6px 0;">${T("res.more", { a: shown.length.toLocaleString(), b: list.length.toLocaleString() })}</button>`
      : "");
    el.querySelectorAll(".place-card").forEach(c =>
      c.addEventListener("click", e => {
        if (e.target.closest("a[data-stop],button")) return;
        selectPlace(c.dataset.id);
      }));
    el.querySelectorAll("[data-detail]").forEach(b =>
      b.addEventListener("click", e => { e.stopPropagation(); selectPlace(b.getAttribute("data-detail")); }));
    const more = $("#loadMoreBtn");
    if (more) more.addEventListener("click", () => {
      state.listLimit = (state.listLimit || LIST_STEP) + LIST_STEP;
      renderList(visiblePlaces());
    });
    observeRatings(el, shown);
  }

  /* ══════════ 목록 카드 평점·실사진 (네이버) ══════════
   * 전량에 요청을 날리면 네이버가 429로 막는다 →
   * 화면에 보이는 카드만, 동시 2건, 목록 한 벌당 RATE_BUDGET개까지.
   * 한 번 받은 결과는 장소 객체(_naver)에 붙여 재렌더링에도 유지한다.
   *
   * ⚠ 관찰 대상은 카드(.place-card)다. 예전에는 평점이 들어갈 .pc-rate 를 관찰했는데
   *   `.pc-rate:empty { display:none }` 때문에 아직 비어 있는 동안은 크기가 0이라
   *   IntersectionObserver가 영원히 교차를 알리지 않았다(= 첫 8장 말고는 평점도
   *   사진도 안 붙는 상태). 카드는 항상 크기가 있어 스크롤대로 확실히 걸린다. */
  /* 평점·실사진을 물어볼 카드 수 상한(목록 한 벌 기준).
   * 문화정보원 데이터는 공개 사진이 아예 없어 카드 사진이 전적으로 여기 달려 있다
   * → 화면에 들어온 카드는 스크롤하는 대로 계속 채운다(예전엔 렌더당 12건에서 멈췄다).
   * 동시 2건 + 429 감지 시 중단이라, 늘려도 화면이 느려지지는 않는다(전부 지연 로드,
   * 응답은 Netlify CDN에 24시간 캐시된다). */
  const RATE_BUDGET = 150;
  let rateQueue = [], rateRunning = 0, rateObserver = null;
  let rateSpent = 0, rateStopped = false;

  /** 카테고리를 새로 열면 예산과 차단 상태를 되돌린다
   *  (한 번 429를 맞았다고 그 세션 내내 사진이 안 나오면 안 된다) */
  function resetRateBudget() {
    rateSpent = 0;
    rateStopped = false;
    rateQueue = [];
  }

  function observeRatings(root, places) {
    const byId = {};
    places.forEach(p => { byId[p.id] = p; });
    if (rateObserver) rateObserver.disconnect();
    rateObserver = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        rateObserver.unobserve(en.target);
        if (rateStopped || rateSpent >= RATE_BUDGET) return;
        const p = byId[en.target.getAttribute("data-id")];
        const rateEl = en.target.querySelector("[data-rate]");
        if (p && rateEl) { rateSpent++; rateQueue.push([p, rateEl]); pumpRatings(); }
      });
    }, { rootMargin: "200px" });
    // 맨 위 카드는 관찰을 기다리지 않고 바로 조회한다(첫 화면에서 평점이 보여야 한다)
    const EAGER = 8;
    let eager = 0;
    root.querySelectorAll(".place-card").forEach(card => {
      const p = byId[card.getAttribute("data-id")];
      const el = card.querySelector("[data-rate]");
      if (!p || !el) return;
      // 이미 받아 둔 값(또는 조회 중) — 요청 없이 평점·사진을 바로 채운다
      if (p._naver !== undefined) { paintRating(el, p._naver); paintPhoto(p, p._naver); return; }
      if (p._naverPending) return;          // 같은 곳을 두 번 물어보지 않는다
      if (eager < EAGER && !rateStopped) {
        eager++; rateSpent++;
        p._naverPending = true;
        rateQueue.push([p, el]);
        return;
      }
      rateObserver.observe(card);
    });
    pumpRatings();
  }

  function paintRating(el, d) {
    if (!d || !d.found || !d.rating) { el.innerHTML = ""; return; }
    el.innerHTML = window.PetAI.stars(d.rating) +
      (d.reviewCount ? `<span class="rc">${T("hot.review", { n: d.reviewCount.toLocaleString() })}</span>` : "") +
      (d.category ? `<span class="rcat">${esc(d.category)}</span>` : "");
  }

  /** 공공데이터에 대표이미지가 없는 곳의 썸네일을 네이버 실사진으로 바꾼다.
   *  평점 조회(placeInfo) 응답에 이미 thumb이 들어 있으므로 추가 요청은 없다. */
  function paintPhoto(p, d) {
    if (!d || !d.found || !d.thumb || p.img) return;
    const box = document.querySelector(`[data-photo="${CSS.escape(String(p.id))}"]`);
    if (!box || box.tagName === "IMG") return;
    const img = new Image();
    img.className = "pc-thumb";
    img.setAttribute("data-photo", p.id);
    img.alt = "";
    img.decoding = "async";
    img.onload = () => { if (box.parentNode) box.replaceWith(img); };
    img.src = d.thumb;   // 실패하면 이모지 자리를 그대로 둔다
  }

  function pumpRatings() {
    while (rateRunning < 2 && rateQueue.length && !rateStopped) {
      const [p, el] = rateQueue.shift();
      rateRunning++;
      p._naverPending = true;
      window.PetAI.placeInfo(p, false)
        .then(d => {
          // 네이버가 막기 시작하면 더 조르지 않는다
          if (d && d.throttled) { rateStopped = true; rateQueue.length = 0; return; }
          p._naver = d;
          // 응답을 기다리는 동안 목록이 다시 그려졌을 수 있다 → 현재 DOM에서 다시 찾는다
          const live = document.body.contains(el)
            ? el : document.querySelector(`[data-rate="${CSS.escape(String(p.id))}"]`);
          if (live) paintRating(live, d);
          paintPhoto(p, d);
        })
        .catch(() => { p._naver = { found: false }; })
        .finally(() => { p._naverPending = false; rateRunning--; pumpRatings(); });
    }
  }

  function renderMarkers(list) {
    if (!state.adapter) return;
    // 검수를 통과한 좌표만 지도에 찍는다 — 틀린 좌표는 엉뚱한 곳에 핀을 남긴다
    const shown = list.filter(p => p._geo !== "suspect").slice(0, MARKER_CAP);
    const simple = shown.length > SIMPLE_MARKER_FROM;
    state.adapter.clearMarkers();
    for (const p of shown) {
      const v = verdictOf(p);
      state.adapter.addMarker(p.lat, p.lng, {
        status: v.status, emoji: TYPE_EMOJI[p.type] || "🐾", title: p.title, simple,
        onClick: () => selectPlace(p.id)
      });
    }
    // 지도 범위 맞추기는 첫 렌더에서만 (로딩 중 매번 하면 화면이 계속 튄다)
    if (shown.length && state.fitPending) {
      state.fitPending = false;
      state.adapter.fitAll(shown.map(p => ({ lat: p.lat, lng: p.lng })));
    }
  }

  /* ══════════ 상세 패널 ══════════ */

  async function selectPlace(id) {
    const p = state.places.find(x => x.id === id) ||
              (state._nearbyPool || []).find(x => x.id === id);
    if (!p) return;
    state.selected = p;
    if (p._geo !== "suspect") state.adapter.setCenter(p.lat, p.lng, true);
    $("#detailPanel").classList.remove("hidden");
    $("#detailBody").innerHTML = `<div class="empty-note">${T("dt.loading")}</div>`;
    renderList(visiblePlaces());

    await getPetInfo(p);
    const v = verdictOf(p);
    const cards = R.ruleCards(p.pet);
    const nearby = await findNearby(p);

    $("#detailBody").innerHTML = `
      ${(() => {
        // 대표사진 → 없으면 네이버 실사진(renderNaverBlock이 받아 채워 넣는다)
        const shot = safeUrl(p.img || (p._naver && p._naver.thumb) || "");
        return shot
          ? `<img class="dt-img" id="dtHero" src="${shot}" alt="${esc(p.title)}" data-imgfail="remove">`
          : `<div class="dt-img" id="dtHero" style="display:flex;align-items:center;justify-content:center;font-size:44px;">${esc(TYPE_EMOJI[p.type] || "🐾")}</div>`;
      })()}
      <div class="dt-title-row">
        <div class="dt-title">${esc(p.title)}</div>
        ${window.PetFav ? window.PetFav.button(p.id, "dt-fav") : ""}
      </div>
      <div class="dt-addr">${window.Icon("pin")}<span>${p.addr ? esc(p.addr) : "-"}</span></div>
      ${p.tel ? `<div class="dt-addr"><a class="dt-tel" href="tel:${encodeURIComponent(p.tel)}">${window.Icon("phone")}${esc(p.tel)}</a></div>` : ""}

      <!-- 길안내는 맨 위 — 상세를 열자마자 바로 출발할 수 있어야 한다.
           국내 경로검색이 되는 카카오맵이 기본, 구글은 위치 확인용(경로 미지원 지역).
           출발지는 카카오맵이 알아서 잡는다 — 우리는 위치를 묻지 않는다. -->
      <div class="route-btns dt-route-top">
        <a class="route-btn kakao" target="_blank" rel="noopener"
           href="${safeUrl(window.PetAI.Route.kakao(p))}">${window.Icon("route")} ${T("dt.routeKakao")}</a>
        <a class="route-btn google" target="_blank" rel="noopener"
           href="${safeUrl(window.PetAI.Route.google(p))}">${T("dt.gmapView")}</a>
        ${window.PetShare ? window.PetShare.buttons(p.id) : ""}
      </div>
      ${p._geo === "suspect" ? `<div class="geo-warn">${window.Icon("help")} ${T("dt.geoSuspect")}</div>` : ""}

      <!-- 평점·후기 (네이버 플레이스) -->
      <div id="dtNaver" class="dt-naver">
        <span class="pk-live-load"><span class="ai-spinner"></span> ${T("dt.rating")}</span>
      </div>

      <div class="dt-verdict v-${esc(v.status)}">
        <b>${SI(v.status)} ${statusLabel(v.status)}</b>
        <ul>${v.reasons.map(r => `<li>${r}</li>`).join("")}</ul>
      </div>

      ${facilityInfoHtml(p)}

      <div class="dt-sec">
        <h3>${window.Icon("list")} ${T("dt.rules")}</h3>
        <div class="rule-grid">
          ${cards.length
            ? cards.map(([k, val]) => `<div class="rule-item"><span class="ri-k">${k}</span><span>${esc(val)}</span></div>`).join("")
            : `<div class="rule-item"><span>${T("dt.noRules", { tel: p.tel ? T("dt.callTel", { tel: p.tel }) : T("dt.checkBefore") })}</span></div>`}
        </div>
        <div class="dt-src">${T("dt.source")}${esc(p.source)}${state.demoMode && !p.verified ? T("dt.callWarn") : ""}</div>
      </div>

      <div class="dt-sec">
        <h3>${window.Icon("kit")} ${T("dt.checklist")}</h3>
        <div class="checklist">
          ${v.checklist.map(c => `<label><input type="checkbox"> ${c}</label>`).join("")}
        </div>
      </div>

      <div class="dt-sec">
        <h3>${window.Icon("pin")} ${T("dt.nearby")} <span style="font-weight:400;color:var(--ink-sub);font-size:12px;">(${state.demoMode ? T("dt.nearbyNear") : T("dt.nearbyRadius", { n: Math.round(CFG.NEARBY_RADIUS_M / 1000) })})</span></h3>
        <div class="nearby-list">
          ${nearby.length ? nearby.map(n => `
            <div class="nearby-card">
              <div>
                <div class="nb-name">${esc(TYPE_EMOJI[n.type] || "🏞️")} ${esc(n.title)}</div>
                <div class="nb-dist">${n.distKm.toFixed(1)}km · ${n.petSummary ? esc(n.petSummary) : T("dt.nearbyRule")}</div>
              </div>
              <div style="display:flex;gap:4px;">
                <button class="btn btn-ghost btn-sm nb-open" data-id="${esc(n.id)}">${T("dt.detail")}</button>
                <a class="btn btn-primary btn-sm" style="display:inline-flex;align-items:center;text-decoration:none;" target="_blank" rel="noopener"
                   href="${safeUrl(window.PetAI.Route.between(p, n))}">${T("dt.route")}</a>
              </div>
            </div>`).join("")
          : `<div class="empty-note" style="padding:12px;">${T("dt.nearbyNone")}</div>`}
        </div>
      </div>

      <div class="dt-sec">
        <h3>${window.Icon("hospital")} ${T("dt.vets")} <span style="font-weight:400;color:var(--ink-sub);font-size:12px;">(${T("dt.vetsSub")})</span></h3>
        <div class="nearby-list" id="vetBox"></div>
      </div>
    `;
    $("#detailBody").querySelectorAll(".nb-open").forEach(b =>
      b.addEventListener("click", () => selectPlace(b.dataset.id)));
    renderVets(p);
    renderNaverBlock(p);
  }

  /** ⭐ 네이버 플레이스 평점·후기 — 상세 패널 상단 블록 */
  async function renderNaverBlock(p) {
    const box = $("#dtNaver");
    if (!box) return;
    const d = await window.PetAI.placeInfo(p, true);
    if (!document.body.contains(box) || !state.selected || state.selected.id !== p.id) return;
    p._naver = d;
    // 공공데이터에 사진이 없으면 상단 대표사진을 네이버 실사진(큰 판)으로 채운다
    if (d && d.found && (d.photo || d.thumb) && !p.img) {
      const hero = $("#dtHero");
      if (hero && hero.tagName !== "IMG") {
        const img = new Image();
        img.className = "dt-img";
        img.id = "dtHero";
        img.alt = p.title;
        img.decoding = "async";
        img.onload = () => { if (hero.parentNode) hero.replaceWith(img); };
        img.src = d.photo || d.thumb;
      }
    }
    if (!d || !d.found) {
      box.innerHTML = `<span class="pk-live-none">${window.Icon("info")} ${T("dt.noRating")}</span>`;
      return;
    }
    const revs = d.reviews || [];
    box.innerHTML = `
      <div class="dtn-head">
        ${window.PetAI.stars(d.rating)}
        ${d.reviewCount ? `<span class="rc">${T("dt.visitorReview", { n: d.reviewCount.toLocaleString() })}</span>` : ""}
        ${d.blogCount ? `<span class="rc">${T("dt.blog", { n: d.blogCount.toLocaleString() })}</span>` : ""}
        ${d.category ? `<span class="rcat">${esc(d.category)}</span>` : ""}
      </div>
      ${revs.length ? `<div class="dtn-revs">${revs.map(r => `
        <div class="dtn-rev">
          ${window.Icon("quote")}
          <div><span class="dtn-body">${esc(r.body)}</span>${r.rating ? `<span class="dtn-r">${esc(r.rating)}</span>` : ""}</div>
        </div>`).join("")}</div>` : ""}
      <a class="pk-naver" target="_blank" rel="noopener" href="${safeUrl(d.url)}">${T("dt.moreNaver")}</a>`;
  }

  /** 🏥 근처 동물병원 (행정안전부 공공데이터) — 지연 로드 */
  async function renderVets(place) {
    const box = $("#vetBox");
    if (!box) return;
    if (state.vetError) { box.innerHTML = vetErrorHtml(state.vetError); return; }
    if (!state.vets) {
      box.innerHTML = `<div class="empty-note" style="padding:10px;">${T("dt.vetsLoading")}</div>`;
      try {
        const r = await Extra.loadVets();
        state.vets = r.items;
      } catch (e) {
        state.vetError = e.info || { hint: e.message };
        box.innerHTML = vetErrorHtml(state.vetError);
        return;
      }
    }
    if (state.selected && state.selected.id !== place.id) return;
    // 좌표를 못 믿는 곳은 거리 계산이 무의미하다 → 같은 시군구 병원을 보여 준다
    const near = place._geo === "suspect"
      ? Extra.vetsInArea(state.vets, place, 3)
      : Extra.nearestVets(state.vets, place, 3);
    box.innerHTML = near.length ? near.map(v => `
      <div class="nearby-card">
        <div>
          <div class="nb-name">${window.Icon("hospital")} ${esc(v.name)}</div>
          <div class="nb-dist">${v.distKm != null ? v.distKm.toFixed(1) + "km · " : ""}${esc(v.addr || "")}${v.tel ? " · ☎ " + esc(v.tel) : ""}</div>
        </div>
        <a class="btn btn-primary btn-sm" style="display:inline-flex;align-items:center;text-decoration:none;" target="_blank" rel="noopener"
           href="${safeUrl(window.PetAI.Route.kakao({ title: v.name, addr: v.addr, lat: v.lat, lng: v.lng }))}">${T("dt.route")}</a>
      </div>`).join("")
      : `<div class="empty-note" style="padding:10px;">${T("dt.vetsNone")}</div>`;
  }

  /** 동물병원 공공데이터 미연결 시 — 카카오맵 지역 검색으로 대체 (키 불필요, 항상 동작) */
  function vetErrorHtml(info) {
    const p = state.selected;
    const gu = ((p && p.addr) || "").match(/([가-힣]+[시군구])/g) || [];
    const area = gu[gu.length - 1] || gu[0] || "";
    const query = T("dt.vetQuery", { area }).trim();
    return `<div class="nearby-card" style="flex-direction:column;align-items:stretch;gap:8px;">
      <div style="font-size:12.5px;color:var(--ink-sub);line-height:1.5;">
        ${T("dt.vetsFallback")}
      </div>
      <a class="btn btn-primary btn-sm" style="display:flex;align-items:center;justify-content:center;text-decoration:none;height:34px;"
         target="_blank" rel="noopener"
         href="https://map.kakao.com/link/search/${encodeURIComponent(query)}">
        ${window.Icon("hospital")} ${T("dt.vetsSearch", { area: area ? area + " " : "" })}
      </a>
    </div>`;
  }

  /** 🏢 시설 정보 (문화정보원 데이터의 운영시간·휴무일·주차·요금 등) */
  function facilityInfoHtml(p) {
    const items = [
      [T("fi.hours"), p._hours],
      [T("fi.holiday"), p._holiday],
      [T("fi.parking"), yn(p._parking)],
      [T("fi.fee"), p._fee],
      [T("fi.petFee"), p._petFee],
      [T("fi.space"), spaceLabel(p._indoor, p._outdoor)]
    ].filter(([, v]) => v && v !== "정보없음" && v !== "해당없음");
    if (!items.length) return "";
    return `<div class="dt-sec">
      <h3>${window.Icon("indoor")} ${T("dt.facility")}</h3>
      <div class="info-grid">
        ${items.map(([k, v]) => `<div class="info-item"><span class="ii-k">${k}</span><span class="ii-v">${esc(v)}</span></div>`).join("")}
      </div>
      ${p._desc && p._desc !== "정보없음" ? `<div class="dt-addr" style="margin-top:8px;">${esc(p._desc)}</div>` : ""}
    </div>`;
  }
  function yn(v) {
    if (!v) return "";
    if (/^y/i.test(v) || v === "가능") return T("fi.yes");
    if (/^n/i.test(v) || v === "불가") return T("fi.no");
    return v;
  }
  function spaceLabel(indoor, outdoor) {
    const i = /^y/i.test(indoor || ""), o = /^y/i.test(outdoor || "");
    if (i && o) return T("fi.both");
    if (i) return T("fi.indoor");
    if (o) return T("fi.outdoor");
    return "";
  }

  function haversineKm(a, b) {
    const rad = Math.PI / 180, R6 = 6371;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R6 * Math.asin(Math.sqrt(h));
  }

  /** 근처 반려동물 동반 관광지 (live: locationBasedList / demo: 샘플 거리계산) */
  async function findNearby(p) {
    let pool = [];
    // 좌표가 의심스러우면 "근처"를 계산할 기준점이 없다 — 엉뚱한 동네를 권하느니 비운다
    if (p._geo === "suspect") { state._nearbyPool = []; return []; }
    if (!state.demoMode) {
      try {
        const items = await fetchLive({
          op: "locationBasedList", mapX: p.lng, mapY: p.lat,
          radius: CFG.NEARBY_RADIUS_M, numOfRows: 30, arrange: "S"
        });
        pool = items.map(it => normalizeItem(it))
          .filter(n => ["12", "14", "28"].includes(n.type) && n.id !== p.id);
      } catch (_) {}
    } else {
      const all = await loadSamples();
      pool = all.filter(it => ["12", "14", "28"].includes(String(it.contenttypeid)))
        .map(it => normalizeItem(it)).filter(n => n.id !== p.id);
    }
    pool.forEach(n => {
      n.distKm = haversineKm(p, n);
      const rules = R.parseRules(n.pet);
      n.petSummary = rules.known
        ? [rules.leashRequired ? T("dt.leashShort") : "",
           rules.indoorBanned || rules.outdoorOnly ? T("dt.outdoorShort") : "",
           rules.allowedSizes.length ? rules.allowedSizes.map(s => R.SIZE_LABEL[s]).join("·") : T("dt.allDog")
          ].filter(Boolean).join(" · ")
        : "";
    });
    pool = pool.filter(n => n.distKm <= Math.max(CFG.NEARBY_RADIUS_M / 1000, 5))
               .sort((a, b) => a.distKm - b.distKm).slice(0, 5);
    state._nearbyPool = pool;
    return pool;
  }

  /* ══════════ 프로필 ══════════ */

  function loadProfile() {
    try { return JSON.parse(localStorage.getItem("petmap_profile")) || null; }
    catch (_) { return null; }
  }

  function saveProfileFromForm() {
    const profile = {
      name: $("#pfName").value.trim() || T("top.mypet"),
      species: $("#pfSpecies").value,
      weightKg: parseFloat($("#pfWeight").value) || 5,
      size: $("#pfSize").value,
      hasLeash: $("#pfLeash").checked,
      hasCage: $("#pfCage").checked,
      hasMuzzle: $("#pfMuzzle").checked,
      vaccinated: $("#pfVaccine").checked
    };
    state.profile = profile;
    state.profileVersion++;    // 판정 캐시 무효화
    localStorage.setItem("petmap_profile", JSON.stringify(profile));
    state.realCounts = {};          // 프로필이 바뀌면 실제 가능 수도 다시 세야 한다
    renderPetForm();
    if (state.page === "home") {
      renderHome();
    } else {
      renderAll();
      recordRealCount();
    }
    const size = profile.size === "auto" ? R.sizeFromWeight(profile.weightKg) : profile.size;
    mascotSay(T("ms.saved", {
      name: esc(profile.name), kg: profile.weightKg,
      size: R.SIZE_LABEL[size], unit: T("unit.dog"), range: R.SIZE_RANGE[size]
    }));
    const card = $("#petForm");
    if (card && state.page === "home") {
      card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash");
      const hb = $("#heroBubble");
      if (hb && hb.offsetParent !== null) hb.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (state.selected) selectPlace(state.selected.id);
  }

  function updateDemoBanner() {
    $("#demoBanner").classList.toggle("hidden", !state.demoMode);
  }

  /* ══════════ 이벤트/초기화 ══════════ */

  function bindEvents() {
    // 상단 네비게이션
    document.querySelectorAll(".nav-btn").forEach(b =>
      b.addEventListener("click", () => showPage(b.dataset.page)));
    $("#brandHome").addEventListener("click", () => showPage("home"));
    $("#toMapBtn").addEventListener("click", () => showPage("map"));
    $("#favBackBtn").addEventListener("click", () => {
      state.favMode = false;
      syncFavMode();
      renderAll();
    });
    /* 저장 목록을 보는 중에 하트를 껐다 켜면 그 자리에서 사라지거나 나타나야 한다 */
    if (window.PetFav && window.PetFav.onChange) {
      window.PetFav.onChange(() => { if (state.favMode) renderAll(); });
    }
    $("#toListBtn").addEventListener("click", () => showPage("results"));
    // 본문 안에서 페이지를 여는 링크(편집 밴드 CTA 등) — nav-btn과 달리 활성 표시는 하지 않는다
    document.querySelectorAll("[data-goto]").forEach(b =>
      b.addEventListener("click", () => showPage(b.dataset.goto)));

    // ✨ AI 검색 (홈 + 모달)
    $("#aiForm").addEventListener("submit", e => {
      e.preventDefault();
      const q = $("#aiInput").value.trim();
      if (q) window.PetAI.ask(q);
    });
    $("#aiForm2").addEventListener("submit", e => {
      e.preventDefault();
      const q = $("#aiInput2").value.trim();
      if (q) { $("#aiInput2").value = ""; window.PetAI.ask(q); }
    });
    document.querySelectorAll(".ex-chip[data-q]").forEach(b =>
      b.addEventListener("click", () => {
        // 영어 화면에서는 영어 질문을 그대로 보낸다(Gemini가 언어를 맞춰 답한다)
        const q = window.I18N.isEn() && b.dataset.qEn ? b.dataset.qEn : b.dataset.q;
        $("#aiInput").value = q;
        window.PetAI.ask(q);
      }));
    // 🔄 재검색 / 초기화 — 브라우저 뒤로가기에 의존하지 않도록
    $("#homeResetBtn").addEventListener("click", () => resetSearch({ toHome: true }));
    $("#aiResetBtn").addEventListener("click", () => { resetSearch(); window.PetAI.askAgain(); });
    $("#resetBtn").addEventListener("click", () => resetSearch());
    $("#reSearchBtn").addEventListener("click", () => { window.PetAI.openModal(); window.PetAI.askAgain(); });
    $("#aiClose").addEventListener("click", () => window.PetAI.closeModal());
    bindModalDragClose();
    $("#aiModal").addEventListener("click", e => {
      if (e.target.id === "aiModal") window.PetAI.closeModal();
    });
    $("#pfBreedBtn").addEventListener("click", () => {
      const b = $("#pfBreed").value.trim();
      if (b) window.PetAI.classifyBreed(b);
    });
    $("#pfBreed").addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); $("#pfBreedBtn").click(); }
    });

    $("#areaSelect").addEventListener("change", e => setArea(e.target.value, { say: false }));

    // 📍 상단바 지역 버튼 — 화면 어디서든 지역을 바꾼다
    $("#regionBtn").addEventListener("click", e => { e.stopPropagation(); toggleRegionPop(); });
    $("#regionPopClose").addEventListener("click", () => toggleRegionPop(false));
    $("#regionPop").addEventListener("click", e => e.stopPropagation());
    document.addEventListener("click", () => toggleRegionPop(false));
    document.addEventListener("keydown", e => { if (e.key === "Escape") toggleRegionPop(false); });

    window.addEventListener("resize", syncTopbarHeight, { passive: true });

    // 🌐 한국어 ↔ English
    $("#langBtn").addEventListener("click", () => window.I18N.toggle());
    document.addEventListener("petmap:lang", () => {
      syncTopbarHeight();                // 문구 길이가 달라지면 상단바 높이도 달라진다
      // 정적 문구는 I18N.apply가 이미 바꿨다 → 자바스크립트가 그린 부분만 다시 그린다
      $("#resultTitle").textContent = metaOf(state.contentType) ? typeName(state.contentType) : T("res.title");
      $("#mapTitle").textContent = metaOf(state.contentType) ? typeName(state.contentType) : T("map.title");
      if (state.adapter) $("#mapSourceTag").textContent = T("map.src") + state.adapter.name;
      renderHome();
      renderAll();
      window.PetTips.relabel();
      if (state.selected) selectPlace(state.selected.id);
    });
    let searchTimer = null;
    $("#searchInput").addEventListener("input", e => {
      state.keyword = e.target.value.trim();
      clearTimeout(searchTimer);          // 타이핑마다 전체 렌더하지 않도록 디바운스
      searchTimer = setTimeout(() => { state.listLimit = LIST_STEP; renderAll(); }, 200);
    });
    $("#fitOnly").addEventListener("change", e => {
      state.fitOnly = e.target.checked;
      if (state.fitOnly && !state.profile) { openProfile(); e.target.checked = false; state.fitOnly = false; return; }
      renderAll();
    });
    $("#profileBtn").addEventListener("click", openProfile);
    $("#pfSave").addEventListener("click", saveProfileFromForm);
    $("#detailClose").addEventListener("click", () => {
      $("#detailPanel").classList.add("hidden");
      state.selected = null;
      renderList(visiblePlaces());
    });

    // ⬅️ 브라우저 뒤로가기로 이전 화면(지도→목록→홈)으로 돌아간다
    window.addEventListener("popstate", e => {
      const name = (e.state && e.state.page) || "home";
      if (!$("#aiModal").classList.contains("hidden")) { window.PetAI.closeModal(); return; }
      if (!$("#detailPanel").classList.contains("hidden")) {
        $("#detailPanel").classList.add("hidden");
        state.selected = null;
        renderList(visiblePlaces());
        return;
      }
      showPage(name, true);
    });
  }

  /* ══════════ AI 연동용 공개 API ══════════ */

  /** AI가 해석한 조건으로 데이터를 불러오고, 판정까지 붙여 돌려준다 */
  async function loadByIntent(intent) {
    if (intent.area != null) {
      state.area = String(intent.area);
      const sel = $("#areaSelect");
      if (sel) sel.value = state.area;
      syncAreaUI();
      document.dispatchEvent(new CustomEvent("petmap:area", { detail: { area: state.area } }));
    }
    if (intent.category) {
      state.contentType = intent.category;
      const name = metaOf(intent.category) ? typeName(intent.category) : T("aj.searchResult");
      $("#resultTitle").textContent = name;
      $("#mapTitle").textContent = name;
    }
    state.keyword = intent.keyword || "";
    const si = $("#searchInput");
    if (si) si.value = state.keyword;
    state.realCounts = {};
    state.aiPicks = [];
    state.aiBusy = true;                 // 로딩 중 마스코트가 AI 답변을 덮어쓰지 않도록
    try { await loadPlaces(); }
    finally { state.aiBusy = false; }

    // AI 조건(크기·실내)으로 한 번 더 추린 뒤, 판정 요약을 붙여 반환
    let list = visiblePlaces();
    if (intent.size && intent.size !== "any") {
      list = list.filter(p => {
        const rules = verdictOf(p).rules;
        if (!rules.known) return true;
        if (rules.allowedSizes.length && !rules.allowedSizes.includes(intent.size)) return false;
        if (rules.weightLimitKg != null && intent.size === "large") return false;
        return true;
      });
    }
    if (intent.indoorOnly) {
      list = list.filter(p => {
        const rules = verdictOf(p).rules;
        return !(rules.outdoorOnly || rules.indoorBanned);
      });
    }
    const ORDER = { ok: 0, cond: 1, unknown: 2, no: 3 };
    return list
      .slice()
      .sort((a, b) => ORDER[verdictOf(a).status] - ORDER[verdictOf(b).status])
      .map(p => {
        const v = verdictOf(p);
        return {
          id: p.id, title: p.title, addr: p.addr, lat: p.lat, lng: p.lng,
          status: v.status,
          verdictLabel: statusLabel(v.status),
          ruleText: v.rules.known ? String(v.rules.raw || "").slice(0, 120) : ""
        };
      });
  }

  function petDescription() {
    const p = state.profile;
    if (!p) return "";
    const size = p.size === "auto" ? R.sizeFromWeight(p.weightKg) : p.size;
    return `${T(p.species === "cat" ? "pf.cat" : "pf.dog")} ${p.name}, ${p.weightKg}kg(${R.SIZE_LABEL[size]}), ` +
      `${T("in.gear")}: ${[p.hasLeash && T("ck.leash"), p.hasCage && T("rb.cage"), p.hasMuzzle && T("rb.muzzle"),
         p.vaccinated && T("pf.vaccine")].filter(Boolean).join("·") || T("in.none")}`;
  }

  /** 홈 오른쪽 카드용 요약 — 프로필 · 현재 보고 있는 데이터 · 가능한 곳 수 */
  function summary() {
    const p = state.profile;
    const rc = state.realCounts[state.contentType];
    return {
      profile: p ? {
        name: p.name,
        weightKg: p.weightKg,
        sizeLabel: R.SIZE_LABEL[p.size === "auto" ? R.sizeFromWeight(p.weightKg) : p.size],
        gear: [p.hasLeash && T("ck.leash"), p.hasCage && T("rb.cage"), p.hasMuzzle && T("rb.muzzle"),
               p.vaccinated && T("pf.vaccine")].filter(Boolean)
      } : null,
      areaName: areaName(state.area),
      categoryName: metaOf(state.contentType) ? typeName(state.contentType) : T("type.none"),
      able: rc ? rc.ok : 0,
      loaded: rc ? rc.loaded : 0,
      no: rc ? rc.no : 0
    };
  }

  window.PetApp = {
    loadByIntent,
    petDescription,
    showPage,
    resetSearch,
    openProfile,
    summary,
    setArea,
    getArea: () => state.area,
    areaName,
    typeName,
    findPlace: (id) => state.places.find(p => String(p.id) === String(id)),
    /** 목록 밖(핫플레이스·근처 관광지·즐겨찾기·공유 링크)에서 온 장소까지 훑는다 —
     *  길안내·공유가 쓴다. 지금 열려 있는 장소를 마지막에 한 번 더 보는 이유는,
     *  findNearby 가 상세를 그리면서 _nearbyPool 을 「근처 3km」 결과로 덮어쓰기 때문이다
     *  (그러면 정작 열어 둔 장소 자신이 목록 어디에도 남지 않는다). */
    findAnyPlace: (id) =>
      state.places.find(p => String(p.id) === String(id)) ||
      (state._nearbyPool || []).find(p => String(p.id) === String(id)) ||
      (state.selected && String(state.selected.id) === String(id) ? state.selected : null),
    openPlace: (id) => { showPage("results"); selectPlace(id); },
    /** 🔥 핫플레이스처럼 목록 밖에서 온 장소를 그 자리에서 상세로 연다 */
    openPlaceData: (raw) => openPlaceFromRaw(raw),
    markAiPicks: (ids) => { state.aiPicks = ids || []; renderList(visiblePlaces()); },
    /** ❤️ 저장한 곳을 목록 화면으로 — 상단바 하트 패널의 「목록에서 보기」가 부른다 */
    showFavorites,
    /** ❤️ 즐겨찾기에 저장해 둔 장소를 그대로 다시 연다.
     *  이미 정규화된 복사본이라 normalizeItem 을 다시 태우지 않는다
     *  (규정 원문 pet 이 비어 있으면 selectPlace 안에서 알아서 다시 받아 온다). */
    adoptPlace: (saved) => {
      if (!saved || saved.id == null) return;
      showPage("results");
      state._nearbyPool = (state._nearbyPool || []).filter(x => String(x.id) !== String(saved.id)).concat(saved);
      selectPlace(saved.id);
    }
  };

  /** 🔗 공유 링크로 들어온 경우 — ?place=<contentId> 하나로 그 장소 상세를 연다.
   *  SNS 로 받은 사람이 목록을 다시 헤매지 않게, 링크가 곧 그 장소가 되게 한다.
   *  (목록에 없는 장소여도 detailCommon 으로 이름·주소·좌표를 직접 받아 온다) */
  async function openSharedPlace() {
    let id = "";
    try { id = new URLSearchParams(location.search).get("place") || ""; } catch (_) {}
    if (!/^\d+$/.test(id)) return false;     // TourAPI contentId 만 되살릴 수 있다
    try {
      const { items } = await fetchLiveBody({ op: "detailCommon", contentId: id });
      if (!items.length) return false;
      openPlaceFromRaw(items[0]);
      return true;
    } catch (_) {
      return false;                     // 링크가 낡았거나 API 가 죽었으면 홈 그대로
    }
  }

  function openPlaceFromRaw(raw) {
    const n = normalizeItem(raw);
    state._nearbyPool = (state._nearbyPool || []).filter(x => x.id !== n.id).concat(n);
    selectPlace(n.id);
  }

  async function init() {
    window.I18N.apply(document);
    window.Icon.hydrate();
    bindEvents();
    syncTopbarHeight();
    renderHome();
    window.HotSpots.init();             // 🔥 맨 아래 [지역][카테고리] 핫한 곳 파노라마
    window.PetAI.loadBreeds();          // 표준 견종표 미리 로드 (품종 입력 즉시 응답)
    window.PetTips.init();              // 상식 카드 · 정보 요약 · 퀴즈
    // 주소창의 #tips 같은 해시를 그대로 열어 준다(공유 링크·새로고침 시 페이지 유지)
    const hashed = (location.hash || "").replace("#", "");
    const start = ["home", "results", "map", "tips"].includes(hashed) ? hashed : "home";
    try { history.replaceState({ page: start }, "", "#" + start); } catch (_) {}
    state.adapter = await window.PetMapAdapter.createMap($("#map"), CFG);
    $("#mapSourceTag").textContent = T("map.src") + state.adapter.name;
    showPage(start, true);
    openSharedPlace();                  // 주소창의 ?place=… (기다리지 않는다 — 화면은 이미 떠 있다)
  }

  init();
})();
