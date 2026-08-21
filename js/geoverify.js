/* ─────────────────────────────────────────────────────────────
 * 좌표 검수 (data/geocheck.json)
 *
 * 공공데이터 좌표는 대부분 정확하지만 소수가 완전히 틀려 있다.
 * 실측(2026-08-13, 80,342건 전수 대조)에서 확인된 유형:
 *   · 바다 한가운데 좌표  — 오산반려동물테마파크·기흥레스피아호수공원 (19.69, 117.99)
 *   · 자릿수 오타        — 황성공원 (35.86,129.22 → 37.86,127.21)
 *   · 시군구 불일치      — 하슬라미술관 (강릉인데 84km 밖)
 * 틀린 좌표로 길안내를 걸면 엉뚱한 곳으로 안내되므로, 렌더 직전에 한 번 거른다.
 *
 * 기준표(data/geocheck.json)
 *   sido : 시도별 경계상자 [남,북,서,동] — 섬(백령도·흑산도·풍도)까지 포함한 실측 범위
 *   sgg  : "시도 시군구" → [중심위도, 중심경도, 허용반경km]
 *   fix  : contentid → 검증된 정확한 좌표 (네이버 지역검색 대조)
 *
 * 판정
 *   ok      : 그대로 사용
 *   suspect : 좌표를 믿지 않는다 → 길안내는 이름+주소 검색으로, 지도 마커는 제외
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  const SIDO_ALIAS = {
    "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
    "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산",
    "세종특별자치시": "세종", "세종시": "세종", "경기도": "경기",
    "강원도": "강원", "강원특별자치도": "강원", "충청북도": "충북", "충청남도": "충남",
    "전라북도": "전북", "전북특별자치도": "전북", "전라남도": "전남",
    "경상북도": "경북", "경상남도": "경남", "제주도": "제주", "제주특별자치도": "제주"
  };
  /* 관광공사 주소는 "경기 파주시"처럼 줄여 쓰기도 한다 */
  const SHORT = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
                 "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

  /* 대한민국 전체 — 기준표가 아직 안 왔을 때도 바다·해외 좌표는 즉시 걸러 낸다 */
  const KR = { s: 32.9, n: 38.75, w: 124.5, e: 132.0 };

  let table = null;
  let loading = null;

  function load() {
    if (table) return Promise.resolve(table);
    if (!loading) {
      loading = fetch("data/geocheck.json")
        .then(r => (r.ok ? r.json() : null))
        .then(j => { table = j || {}; return table; })
        .catch(() => { table = {}; return table; });
    }
    return loading;
  }

  function sidoOf(addr) {
    const a = String(addr || "").trim();
    if (!a) return "";
    for (const k in SIDO_ALIAS) if (a.indexOf(k) === 0) return SIDO_ALIAS[k];
    for (const s of SHORT) if (a.indexOf(s) === 0) return s;
    return "";
  }

  /** 주소에서 시군구를 뽑는다 — "천안시 서북구"처럼 시+구가 이어지면 둘 다 */
  function sggOf(addr) {
    const parts = String(addr || "").split(/\s+/).slice(1, 4);
    const hit = parts.filter(p => /[시군구]$/.test(p));
    if (!hit.length) return "";
    if (hit.length > 1 && /시$/.test(hit[0]) && /구$/.test(hit[1])) return hit[0] + " " + hit[1];
    return hit[0];
  }

  function km(y1, x1, y2, x2) {
    const dy = (y1 - y2) * 111.0, dx = (x1 - x2) * 88.8;
    return Math.sqrt(dy * dy + dx * dx);
  }

  /**
   * 좌표를 검수한다. 필요하면 place.lat/lng 를 검증된 값으로 교정한다.
   * @returns {"ok"|"suspect"} suspect = 좌표를 길안내·마커에 쓰면 안 됨
   */
  function verify(place) {
    if (!place) return "suspect";
    const t = table || {};

    // ① 검증된 교정 좌표가 있으면 갈아 끼운다
    const fix = (t.fix && t.fix[String(place.id)]) ||
                (t.fixByName && t.fixByName[String(place.title || "").trim()]);
    if (fix) {
      place.lat = fix[0];
      place.lng = fix[1];
      place._geoFixed = true;
      return "ok";
    }

    const y = place.lat, x = place.lng;
    if (typeof y !== "number" || typeof x !== "number" || !isFinite(y) || !isFinite(x) || (!y && !x)) {
      return "suspect";
    }
    // ② 대한민국 밖 — 기준표 없이도 확실한 오류
    if (y < KR.s || y > KR.n || x < KR.w || x > KR.e) return "suspect";

    const sido = sidoOf(place.addr);
    if (!sido) return "ok";                       // 주소로 지역을 못 읽으면 판단 보류

    // ③ 시도 경계상자
    const b = t.sido && t.sido[sido];
    if (b && (y < b[0] || y > b[1] || x < b[2] || x > b[3])) return "suspect";

    // ④ 시군구 중심에서 허용반경 밖
    const sgg = sggOf(place.addr);
    const c = sgg && t.sgg && t.sgg[sido + " " + sgg];
    if (c && km(y, x, c[0], c[1]) > c[2]) return "suspect";

    return "ok";
  }

  window.PetGeo = { load, verify, sidoOf, sggOf, get table() { return table; } };
})();
