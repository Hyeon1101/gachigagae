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

  async function callAI(payload) {
    const res = await fetch(window.API("/api/ai"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ lang: window.I18N.lang }, payload))
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      const err = new Error(json.message || json.error || `AI ${res.status}`);
      err.code = json.error;
      throw err;
    }
    return json.data;
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
  async function ask(q) {
    if (!q || !q.trim()) return;
    openModal();
    thinking(true);
    say(`<span class="ai-spinner"></span> ${T("aj.thinking", { q: escapeHtml(q) })}`);
    setResult("");

    let intent;
    try {
      intent = await callAI({ mode: "search", q });
    } catch (e) {
      thinking(false);
      say(aiErrorMsg(e));
      return;
    }

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
      thinking(false);
      setResult(`<div class="empty-note" style="padding:14px;">${T("aj.fail")}${escapeHtml(e.message)}</div>`);
      return;
    }

    if (!places.length) {
      thinking(false);
      say(`${escapeHtml(intent.reply || "")}${T("aj.notFound")}`);
      setResult(actionRow(intent));
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
    try {
      advice = await callAI({ mode: "advise", q, places: listText, pet: petDesc });
    } catch (_) { /* 추천 실패해도 목록은 보여준다 */ }

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
    const pr = fetch(window.API(`/api/place?${qs}`))
      .then(r => r.json())
      .catch(() => ({ found: false }));
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
        d = await callAI({ mode: "breed", breed });
        src = T("aj.gemini");
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
