/* ─────────────────────────────────────────────────────────────
 * 🔥 [(지역) (카테고리) 핫한 곳] — 홈 맨 아래 파노라마
 *
 *  · 공공데이터(TourAPI)에는 평점이 없다 → /api/place(네이버 플레이스)로
 *    후보의 방문자 평점을 받아 높은 순으로 세운다.
 *  · 네이버는 몰아치면 429를 준다 → 동시 2건, 후보 18곳까지만.
 *    도착하는 대로 카드를 다시 세워 화면이 멈추지 않게 한다.
 *  · 지역·카테고리 버튼은 제목 안에 있어서 보는 자리에서 바로 바꾼다.
 *    (지역은 앱 전체 지역과 연동 — 상단바·홈 칩과 같은 값을 본다)
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const T = (k, v) => window.T(k, v);

  /* 대표사진이 있어 파노라마에 어울리는 TourAPI 카테고리 */
  const CATS = ["12", "39", "32", "28", "38", "14"];
  /* TourAPI 「반려동물 동반여행」은 식당이 전국 75곳뿐이라 시도 단위로는 서너 곳만 나온다
   * → 모자라면 문화정보원 데이터(같은 성격의 카테고리)로 채워 파노라마를 세운다 */
  const CULTURE_OF = { "39": "cafe", "12": "trip", "32": "trip", "28": "trip", "38": "service", "14": "trip" };
  const SIDO_NAME = {
    "1": "서울특별시", "2": "인천광역시", "3": "대전광역시", "4": "대구광역시", "5": "광주광역시",
    "6": "부산광역시", "7": "울산광역시", "8": "세종특별자치시", "31": "경기도", "32": "강원특별자치도",
    "33": "충청북도", "34": "충청남도", "35": "경상북도", "36": "경상남도",
    "37": "전북특별자치도", "38": "전라남도", "39": "제주특별자치도"
  };
  const MIN_POOL = 12;     // 이보다 적으면 문화정보원 데이터로 보충
  const CANDIDATES = 18;   // 평점을 물어볼 후보 수
  const SHOW = 12;         // 파노라마에 세우는 카드 수
  const CONCURRENCY = 2;   // 네이버 동시 요청 (그 이상은 429)

  const cache = new Map();          // "area|type" → 완성된 카드 목록
  const state = { type: "12", seq: 0, loaded: false, catOpen: false };

  const area = () => window.PetApp.getArea();
  const key = () => `${area()}|${state.type}`;

  /* ══════════ 제목 ══════════ */

  function renderTitle() {
    const el = $("#hotTitle");
    if (!el) return;
    const areaBtn = `<button type="button" class="hot-pick" id="hotAreaBtn">${window.PetApp.areaName(area())}<i class="hot-caret"></i></button>`;
    const catBtn = `<button type="button" class="hot-pick" id="hotCatBtn">${window.PetApp.typeName(state.type)}<i class="hot-caret"></i></button>`;
    el.innerHTML = T("hot.pattern", { area: areaBtn, cat: catBtn }) +
      `<div class="hot-cat-pop hidden" id="hotCatPop">${CATS.map(c =>
        `<button type="button" class="area-chip${c === state.type ? " on" : ""}" data-cat="${c}">${window.PetApp.typeName(c)}</button>`).join("")}</div>`;

    $("#hotAreaBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      // 지역은 앱 전체와 공유 → 상단바 팝오버를 그대로 연다
      const btn = $("#regionBtn");
      if (btn) { btn.scrollIntoView({ block: "nearest" }); btn.click(); }
    });
    const pop = $("#hotCatPop");
    $("#hotCatBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      pop.classList.toggle("hidden");
    });
    pop.querySelectorAll("[data-cat]").forEach(b =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        pop.classList.add("hidden");
        if (b.dataset.cat === state.type) return;
        state.type = b.dataset.cat;
        renderTitle();
        load();
      }));
  }

  /* 제목은 지역·언어가 바뀔 때마다 다시 그린다 → 바깥 클릭 닫기는 한 번만 걸어 둔다 */
  document.addEventListener("click", () => {
    const pop = $("#hotCatPop");
    if (pop) pop.classList.add("hidden");
  });

  /* ══════════ 데이터 ══════════ */

  async function fetchCandidates() {
    const params = new URLSearchParams({
      op: "areaBasedList", contentTypeId: state.type,
      arrange: "O",                    // 대표이미지가 있는 항목 우선
      numOfRows: "100", pageNo: "1"
    });
    if (area()) params.set("areaCode", area());
    // 시한이 없으면 서버가 매달릴 때 「찾는 중…」이 영영 안 끝난다
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 25000) : null;
    let res;
    try { res = await fetch(window.API(`/api/pettour?${params}`), { signal: ctrl ? ctrl.signal : undefined }); }
    finally { if (timer) clearTimeout(timer); }
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    const body = json.response && json.response.body;
    let items = body && body.items && body.items.item ? body.items.item : [];
    if (!Array.isArray(items)) items = [items];
    // 사진이 있는 곳을 앞으로 (파노라마는 사진이 주인공이다)
    items.sort((a, b) => (b.firstimage ? 1 : 0) - (a.firstimage ? 1 : 0));

    // 관광공사 수록이 적은 카테고리는 문화정보원 시설로 채운다
    if (items.length < MIN_POOL) {
      try {
        const r = await window.Extra.loadCulture({
          catKey: CULTURE_OF[state.type] || "trip",
          sido: SIDO_NAME[area()] || "",
          perPage: 200, maxPages: 1
        });
        const seen = new Set(items.map(i => String(i.title).trim()));
        for (const c of r.items) {
          if (items.length >= CANDIDATES) break;
          if (seen.has(String(c.title).trim())) continue;
          seen.add(String(c.title).trim());
          items.push(c);                      // toPlace가 이미 같은 필드 형태로 만들어 준다
        }
      } catch (_) { /* 보충 실패해도 관광공사 결과로 간다 */ }
    }
    return items.slice(0, CANDIDATES);
  }

  /** 후보를 동시 2건으로 훑어 평점을 채운다. 한 건 끝날 때마다 onTick */
  async function fillRatings(list, onTick, seq) {
    const queue = list.slice();
    async function worker() {
      while (queue.length) {
        if (seq !== state.seq) return;               // 지역·카테고리가 바뀌면 중단
        const p = queue.shift();
        try {
          const d = await window.PetAI.placeInfo({
            id: p.contentid, title: p.title, addr: p.addr1,
            lat: parseFloat(p.mapy), lng: parseFloat(p.mapx)
          }, false);
          if (d && d.throttled) { queue.length = 0; return; }   // 네이버가 막으면 그만 조른다
          if (d && d.found) {
            p._rating = d.rating || null;
            p._reviewCount = d.reviewCount || null;
            p._category = d.category || "";
            p._thumb = d.thumb || "";
          }
        } catch (_) { /* 개별 실패는 건너뛴다 */ }
        if (seq === state.seq) onTick();
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  }

  /* ══════════ 렌더 ══════════ */

  function photoUrl(p) {
    // 관광공사 이미지 일부가 http:// 라 https 사이트에서 차단된다 → 올려 준다
    return String(p._thumb || p.firstimage || p.firstimage2 || "").replace(/^http:\/\//i, "https://");
  }

  function cardInner(p, rank) {
    const img = photoUrl(p);
    const rate = p._rating
      ? `<span class="hc-rate">${window.Icon("star")}<b>${p._rating.toFixed(1)}</b></span>` +
        (p._reviewCount ? `<span class="hc-rc">${T("hot.review", { n: p._reviewCount.toLocaleString() })}</span>` : "")
      : `<span class="hc-rc">${T("hot.noRate")}</span>`;
    return `<span class="hc-photo">${img
        ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" data-imgfail="remove">`
        : ""}<span class="hc-rank">${rank}</span></span>
      <span class="hc-body">
        <span class="hc-title">${esc(p.title)}</span>
        <span class="hc-meta">${rate}</span>
        <span class="hc-addr">${esc(shortAddr(p.addr1))}</span>
      </span>`;
  }
  /* 내용이 실제로 바뀌었을 때만 다시 그리기 위한 지문
   * (「리뷰 N」 같은 문구가 언어를 타므로 언어도 지문에 넣는다) */
  const cardSig = (p, rank) =>
    [window.I18N.lang, rank, p._rating || "", p._reviewCount || "", photoUrl(p), p.title].join("|");

  /* 트랙을 새로 만들지 않고 카드만 갈아 끼운다.
   * 같은 줄을 두 벌 이어 붙여야 -50%까지 흘렀을 때 이음매가 보이지 않는다. */
  function syncTrack(track, shown) {
    const pool = new Map();
    track.querySelectorAll(".hot-card").forEach(c => pool.set(c.dataset.k, c));
    for (let copy = 0; copy < 2; copy++) {
      shown.forEach((p, i) => {
        const k = copy + ":" + p.contentid;
        let c = pool.get(k);
        if (!c) {
          c = document.createElement("button");
          c.type = "button";
          c.className = "hot-card";
          c.dataset.k = k;
          c.dataset.id = p.contentid;
          if (copy) c.setAttribute("aria-hidden", "true");   // 두 벌째는 읽어 주지 않는다
        } else pool.delete(k);
        const sig = cardSig(p, i + 1);
        if (c.dataset.sig !== sig) { c.innerHTML = cardInner(p, i + 1); c.dataset.sig = sig; }
        track.appendChild(c);      // 순서대로 다시 붙이면 그대로 재정렬된다
      });
    }
    pool.forEach(c => c.remove());
  }

  function shortAddr(a) {
    const parts = String(a || "").split(" ").filter(Boolean);
    return parts.slice(0, 3).join(" ");
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function paint(list, loading) {
    const rail = $("#hotRail");
    if (!rail) return;
    /* 평점이 도착할 때마다 줄을 다시 세우면 카드가 계속 자리를 바꿔 어지럽다
     * → 받는 동안은 순서를 그대로 두고, 다 받은 뒤 한 번만 평점 순으로 세운다 */
    const ordered = loading ? list.slice()
      : list.filter(p => p._rating).sort((a, b) => b._rating - a._rating)
            .concat(list.filter(p => !p._rating));
    const shown = ordered.slice(0, SHOW);
    if (!shown.length) {
      rail.innerHTML = `<div class="hot-empty">${loading
        ? `<span class="ai-spinner"></span> ${T("hot.loading")}` : T("hot.none")}</div>`;
      return;
    }
    state.shown = shown;

    let track = rail.querySelector(".hot-track");
    if (!track) {
      rail.innerHTML = "";
      track = document.createElement("div");
      track.className = "hot-track";
      track.style.animationDuration = Math.max(28, shown.length * 5) + "s";
      rail.appendChild(track);
    }
    syncTrack(track, shown);

    const spin = rail.querySelector(".hot-loading");
    if (loading && !spin) {
      const s = document.createElement("span");
      s.className = "hot-loading";
      s.innerHTML = `<span class="ai-spinner"></span>`;
      rail.appendChild(s);
    } else if (!loading && spin) spin.remove();

    if (!rail.dataset.bound) {          // 카드가 계속 바뀌므로 위임으로 한 번만 건다
      rail.dataset.bound = "1";
      rail.addEventListener("click", (e) => {
        const c = e.target.closest && e.target.closest(".hot-card");
        if (!c) return;
        const p = (state.shown || []).find(x => String(x.contentid) === c.dataset.id);
        if (p) window.PetApp.openPlaceData(p);
      });
    }
  }

  /* ══════════ 로드 ══════════ */

  async function load(force) {
    const seq = ++state.seq;
    const k = key();
    if (!force && cache.has(k)) { paint(cache.get(k), false); return; }
    paint([], true);
    let list;
    try {
      list = await fetchCandidates();
    } catch (_) {
      if (seq === state.seq) paint([], false);
      return;
    }
    if (seq !== state.seq) return;
    if (!list.length) { paint([], false); return; }
    paint(list, true);
    await fillRatings(list, () => paint(list, true), seq);
    if (seq !== state.seq) return;
    cache.set(k, list);
    paint(list, false);
  }

  /* ══════════ 초기화 ══════════ */

  function init() {
    renderTitle();
    const band = $("#hotBand");
    if (!band) return;

    /* 맨 아래 섹션이라 화면에 들어올 때 처음 불러온다(첫 화면 로딩을 막지 않는다).
     * IntersectionObserver가 동작하지 않는 환경(백그라운드 탭·일부 웹뷰)에서도
     * 스크롤 위치를 직접 재서 반드시 한 번은 불러오도록 이중으로 건다. */
    function maybeLoad() {
      if (state.loaded) return true;
      const r = band.getBoundingClientRect();
      if (r.top < window.innerHeight + 300 && r.bottom > -300) {
        state.loaded = true;
        load();
        return true;
      }
      return false;
    }
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting) && maybeLoad()) io.disconnect();
      }, { rootMargin: "300px" });
      io.observe(band);
    }
    const home = document.getElementById("pageHome");
    const onScroll = () => { if (maybeLoad()) home && home.removeEventListener("scroll", onScroll); };
    if (home) home.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    setTimeout(maybeLoad, 600);   // 짧은 화면에서 처음부터 보이는 경우
    /* 맨 아래라 스크롤해야 보이는데, 후보 18곳의 평점을 네이버에서 받는 데 처음엔 20초 안팎 걸린다.
     * 그래서 내려와 보면 늘 「찾는 중…」이었다 → 첫 화면이 다 뜬 뒤 한가할 때 미리 받아 둔다.
     * (응답은 CDN 에 하루 남아 같은 지역·카테고리는 다음 방문자부터 즉시 온다) */
    // 한가한 틈이 끝내 안 오는 환경(백그라운드 탭·숨은 창)도 있어 2초 시한을 함께 건다
    const idle = window.requestIdleCallback
      ? (fn) => window.requestIdleCallback(fn, { timeout: 2000 })
      : (fn) => setTimeout(fn, 1);
    setTimeout(() => idle(() => {
      if (state.loaded) return;
      state.loaded = true;
      load();
    }), 3000);

    const rf = $("#hotRefresh");
    if (rf) rf.addEventListener("click", () => { state.loaded = true; load(true); });

    // 지역이 바뀌면 제목과 카드가 함께 따라간다
    document.addEventListener("petmap:area", () => {
      renderTitle();
      if (state.loaded) load();
    });
    document.addEventListener("petmap:lang", () => {
      renderTitle();
      const k = key();
      if (cache.has(k)) paint(cache.get(k), false);
    });
  }

  window.HotSpots = { init, load, setType: (t) => { state.type = t; renderTitle(); load(); } };
})();
