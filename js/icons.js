/* ─────────────────────────────────────────────────────────────
 * 아이콘 세트
 *  이모지는 OS(특히 윈도우)마다 흑백·다른 모양으로 렌더돼 UI가 지저분해진다.
 *  → 버튼·태그는 인라인 SVG(currentColor)로, 브랜드/AI 표식은 마스코트 로고로 통일.
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  const S = (d, extra) =>
    `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  const ICON = {
    home:    S(`<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-5.5h5V20"/>`),
    list:    S(`<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none"/>`),
    map:     S(`<path d="m9 4-6 2.5v13L9 17l6 3 6-2.5v-13L15 7 9 4Z"/><path d="M9 4v13M15 7v13"/>`),
    pin:     S(`<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>`),
    route:   S(`<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8.4 18H14a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h1.6"/>`),
    refresh: S(`<path d="M20 11a8 8 0 1 0-.9 4.6"/><path d="M20 5v6h-6"/>`),
    search:  S(`<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>`),
    phone:   S(`<path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6L16.5 13l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.5 5.7a2 2 0 0 1 2-2.2Z"/>`),
    info:    S(`<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/>`),
    indoor:  S(`<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-4h4v4"/>`),
    tag:     S(`<path d="M3.5 11.2V4.5h6.7l9.3 9.3a2 2 0 0 1 0 2.8l-3.9 3.9a2 2 0 0 1-2.8 0L3.5 11.2Z"/><circle cx="7.6" cy="8.4" r="1.3" fill="currentColor" stroke="none"/>`),
    size:    S(`<path d="M3 8h18M3 16h18"/><path d="M6 5.5v5M18 13.5v5"/>`),
    close:   S(`<path d="m6 6 12 12M18 6 6 18"/>`),
    check:   S(`<path d="m4.5 12.5 5 5 10-11"/>`),
    warn:    S(`<path d="M12 4.5 21 19.5H3L12 4.5Z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>`),
    ban:     S(`<circle cx="12" cy="12" r="8.5"/><path d="m6.5 6.5 11 11"/>`),
    help:    S(`<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.3 2.6c-.6.3-.9.8-.9 1.5v.3"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>`),
    kit:     S(`<path d="M4.5 8.5h15V20h-15z"/><path d="M9 8.5V6a3 3 0 0 1 6 0v2.5"/>`),
    hospital: S(`<path d="M4.5 9 12 4l7.5 5v11h-15z"/><path d="M12 10v5M9.5 12.5h5"/>`),
    bulb:    S(`<path d="M9 17.5h6"/><path d="M10 20.5h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.5.4.7.9.7 1.5h5c0-.6.2-1.1.7-1.5A5.5 5.5 0 0 0 12 3.5Z"/>`),
    sound:   S(`<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4v-5Z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6"/><path d="M18 6.7a7.5 7.5 0 0 1 0 10.6"/>`),
    mute:    S(`<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4v-5Z"/><path d="m16 9.8 4.5 4.4M20.5 9.8 16 14.2"/>`),
    paw:     S(`<ellipse cx="7" cy="9" rx="1.9" ry="2.4"/><ellipse cx="12" cy="7.2" rx="1.9" ry="2.5"/><ellipse cx="17" cy="9" rx="1.9" ry="2.4"/><path d="M12 12.2c2.6 0 4.6 1.9 4.6 4 0 1.6-1.3 2.6-2.9 2.6-1 0-1.2-.4-1.7-.4s-.7.4-1.7.4c-1.6 0-2.9-1-2.9-2.6 0-2.1 2-4 4.6-4Z"/>`),
    /* ❤️ 즐겨찾기 — 빈 하트(모노라인)와 채운 하트가 같은 자리에서 바뀐다 */
    heart:   S(`<path d="M12 20s-7.2-4.6-7.2-9.5A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.2 2.8C19.2 15.4 12 20 12 20Z"/>`),
    heartOn: `<svg class="ic ic-heart-on" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
             `<path d="M12 20s-7.2-4.6-7.2-9.5A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.2 2.8C19.2 15.4 12 20 12 20Z"/></svg>`,
    /* 공유 — 세 점을 잇는 표준 모양 */
    share: `<svg class="ic ic-share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
           `<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/>` +
           `<path d="M8.3 10.8 15.7 6.6M8.3 13.2l7.4 4.2"/></svg>`,
    /* 구글 G — 브랜드 색 고정(currentColor를 쓰지 않는 유일한 아이콘) */
    google: `<svg class="ic ic-google" viewBox="0 0 48 48" aria-hidden="true">` +
            `<path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.7-.4-4H24v7.4h12.1c-.2 2-1.6 5-4.5 7l6.9 5.3c4.1-3.8 6.6-9.4 6.6-15.7Z"/>` +
            `<path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.3c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41.1 15.4 46 24 46Z"/>` +
            `<path fill="#FBBC05" d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 10l7.1-5.5Z"/>` +
            `<path fill="#EA4335" d="M24 9.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.4 29.9 1 24 1 15.4 1 8.1 5.9 4.4 14l7.1 5.5C13.3 14.2 18.2 9.5 24 9.5Z"/></svg>`,
    star: `<svg class="ic ic-star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
          `<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9L12 3.6Z"/></svg>`,
    quote: `<svg class="ic ic-quote" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
           `<path d="M9.4 6.2c-3 1.3-4.8 3.7-4.8 6.6 0 2.8 1.6 4.6 3.9 4.6 1.9 0 3.3-1.4 3.3-3.2 0-1.8-1.2-3-2.9-3-.3 0-.6 0-.8.1.3-1.4 1.4-2.6 3-3.4l-1.7-1.7Zm8.6 0c-3 1.3-4.8 3.7-4.8 6.6 0 2.8 1.6 4.6 3.9 4.6 1.9 0 3.3-1.4 3.3-3.2 0-1.8-1.2-3-2.9-3-.3 0-.6 0-.8.1.3-1.4 1.4-2.6 3-3.4L18 6.2Z"/></svg>`
  };

  /* ── 카테고리 아이콘 ──
   * 이모지는 OS마다 색·모양이 달라 흑백 편집 톤을 깨뜨린다 → 모노라인 SVG로 교체. */
  const CAT_ICON = {
    "39":  S(`<path d="M6 3v7a2 2 0 0 0 4 0V3"/><path d="M8 10v11"/><path d="M17 3c-1.7 1.2-2.5 3-2.5 5.5S15.3 12 17 12.5V21"/>`),
    "12":  S(`<path d="M3 19h18"/><path d="m6 19 5.5-9 3 4.5 2-3L21 19"/><circle cx="8" cy="6.5" r="1.6"/>`),
    "38":  S(`<path d="M5 8h14l-1.2 12H6.2L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>`),
    "32":  S(`<path d="M3 19v-9"/><path d="M3 13h13a5 5 0 0 1 5 5v1"/><path d="M21 19v-2"/><circle cx="7.5" cy="9.5" r="2"/>`),
    "28":  S(`<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v6M12 14.5v6M3.5 12h6M14.5 12h6"/>`),
    "14":  S(`<path d="M4 9.5 12 4l8 5.5"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/><path d="M3.5 20.5h17"/>`),
    "culture:medical": S(`<path d="M12 4.5v15M4.5 12h15"/>`),
    "culture:service": S(`<path d="M12 3.5c2.6 3.4 4 5.8 4 7.6a4 4 0 0 1-8 0c0-1.8 1.4-4.2 4-7.6Z"/><path d="M6 20.5h12"/>`),
    "culture:trip": S(`<path d="M3.5 13.5 21 5l-4 9.5-4.5 1.5-1.5 4.5-2-4.5-6-2Z"/>`),
    "culture:cafe": S(`<path d="M4.5 7h12v6a5 5 0 0 1-10 0V7Z"/><path d="M16.5 8.5H19a2.2 2.2 0 0 1 0 4.4h-2.5"/><path d="M4 20.5h14"/>`)
  };

  /** 브랜드 마크 — 위치 핀 안에 발자국. 단색(currentColor) 모노라인. */
  function brandMark() {
    return `<svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 30s10.5-9.2 10.5-17A10.5 10.5 0 0 0 5.5 13c0 7.8 10.5 17 10.5 17Z"
            fill="currentColor"/>
      <ellipse cx="11.4" cy="10.6" rx="1.5" ry="2" fill="#fff"/>
      <ellipse cx="15.9" cy="9.1"  rx="1.5" ry="2.1" fill="#fff"/>
      <ellipse cx="20.4" cy="10.6" rx="1.5" ry="2" fill="#fff"/>
      <path d="M15.9 13.6c2.3 0 4 1.7 4 3.5 0 1.4-1.1 2.3-2.5 2.3-.9 0-1.1-.4-1.5-.4s-.6.4-1.5.4c-1.4 0-2.5-.9-2.5-2.3 0-1.8 1.7-3.5 4-3.5Z" fill="#fff"/>
    </svg>`;
  }

  /** 강아지/고양이 마스코트 로고 — 사용자가 고른 도우미를 따라간다 */
  function mascotSrc() {
    return (localStorage.getItem("petmap_helper_kind") || "dog") === "cat"
      ? "assets/helper_cat.png" : "assets/helper_dog.png";
  }
  function logo(cls) {
    return `<img class="pet-logo ${cls || ""}" src="${mascotSrc()}" alt="" aria-hidden="true">`;
  }

  /** 정적 마크업의 <i data-ic="..."> / <span data-logo="..."> / <span data-mark> 를 채운다 */
  function hydrate(root) {
    const r = root || document;
    r.querySelectorAll("[data-ic]").forEach(el => {
      el.innerHTML = ICON[el.getAttribute("data-ic")] || "";
      el.classList.add("ic-wrap");
    });
    r.querySelectorAll("[data-logo]").forEach(el => {
      el.innerHTML = logo(el.getAttribute("data-logo"));
    });
    r.querySelectorAll("[data-mark]").forEach(el => { el.innerHTML = brandMark(); });
  }

  window.Icon = function (name) { return ICON[name] || ""; };
  window.Icon.all = ICON;
  window.Icon.cat = function (type) { return CAT_ICON[type] || ICON.paw; };
  window.Icon.mark = brandMark;
  window.Icon.logo = logo;
  window.Icon.mascotSrc = mascotSrc;
  window.Icon.hydrate = hydrate;
  hydrate();   // 스크립트가 body 끝에 있으므로 DOM은 이미 준비돼 있다
})();
