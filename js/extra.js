/* ─────────────────────────────────────────────────────────────
 * 추가 공공데이터 연동
 *  - culture : 한국문화정보원 반려동물 동반 가능 문화시설 (70,650건)
 *  - vet     : 행정안전부 동물병원 (9,445건)
 *
 * 두 데이터는 파일데이터 자동변환 API라 컬럼명이 데이터셋마다 다르다.
 * → 첫 페이지의 키 목록을 보고 스키마를 자동 탐지한다(detectSchema).
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  const schemaCache = {};

  /** 키 이름에 포함된 단어로 컬럼을 찾는다 (부분일치, 우선순위 순) */
  function pick(keys, patterns, exclude) {
    for (const pat of patterns) {
      const hit = keys.find(k => {
        const s = k.replace(/\s/g, "");
        if (exclude && exclude.some(x => s.includes(x))) return false;
        return s.includes(pat);
      });
      if (hit) return hit;
    }
    return null;
  }

  function detectSchema(row) {
    const keys = Object.keys(row || {});
    return {
      keys,
      name: pick(keys, ["시설명", "사업장명", "업소명", "상호", "명칭", "이름"]),
      addr: pick(keys, ["도로명주소", "소재지도로명주소", "지번주소", "소재지지번주소", "소재지전체주소", "주소"]),
      lat: pick(keys, ["위도", "latitude", "LA", "y좌표"]),
      lng: pick(keys, ["경도", "longitude", "LO", "x좌표"]),
      tel: pick(keys, ["전화번호", "연락처", "소재지전화"]),
      homepage: pick(keys, ["홈페이지", "url"]),
      hours: pick(keys, ["운영시간", "영업시간"]),
      holiday: pick(keys, ["휴무일", "휴무"]),
      category: pick(keys, ["카테고리3", "카테고리2", "카테고리", "업태", "분류"]),
      status: pick(keys, ["영업상태명", "영업상태", "상태"]),
      // 반려동물 규정 관련
      petAllow: pick(keys, ["동반가능정보", "동반가능", "애견동반", "반려동물동반"]),
      petSize: pick(keys, ["입장가능동물크기", "동물크기", "가능동물크기"]),
      petLimit: pick(keys, ["반려동물제한사항", "애견제한사항", "제한사항"]),
      petFee: pick(keys, ["추가요금", "동반추가요금"]),
      petOnly: pick(keys, ["전용정보", "반려동물전용"]),
      indoor: pick(keys, ["장소(실내)", "실내여부", "실내"]),
      outdoor: pick(keys, ["장소(실외)", "실외여부", "실외"]),
      parking: pick(keys, ["주차가능", "주차"])
    };
  }

  async function callApi(src, params = {}) {
    const q = new URLSearchParams({ src, ...params }).toString();
    const res = await fetch(window.API(`/api/extra?${q}`));
    const json = await res.json();
    if (json.error) throw Object.assign(new Error(json.hint || json.message || json.error), { info: json });
    return json;
  }

  /** 문화정보원 시설 → 앱 공통 포맷(normalizeItem 입력 형태)으로 변환 */
  function toPlace(row, s, srcLabel, typeId) {
    const val = (k) => (k && row[k] != null ? String(row[k]).trim() : "");
    const feeKey = Object.keys(row).find(k => k.replace(/\s/g, "").includes("입장(이용료)"));
    const petBits = [
      val(s.petAllow) && `동반 정보: ${val(s.petAllow)}`,
      val(s.petSize) && `입장 가능 크기: ${val(s.petSize)}`,
      val(s.petLimit) && `제한사항: ${val(s.petLimit)}`,
      val(s.petFee) && `추가 요금: ${val(s.petFee)}`,
      val(s.petOnly) && `전용 정보: ${val(s.petOnly)}`
    ].filter(Boolean);

    const indoorV = val(s.indoor), outdoorV = val(s.outdoor);
    let placeNote = "";
    if (/^(y|Y|가능|있음|1|true)/.test(outdoorV) && !/^(y|Y|가능|있음|1|true)/.test(indoorV)) {
      placeNote = "실외 공간만 이용 가능";
    }

    return {
      contentid: `culture-${val(s.name)}-${val(s.lat)}-${val(s.lng)}`.slice(0, 80),
      title: val(s.name) || "(이름 없음)",
      contenttypeid: typeId,
      addr1: val(s.addr),
      tel: val(s.tel),
      mapx: parseFloat(val(s.lng)),
      mapy: parseFloat(val(s.lat)),
      firstimage: "",
      source: srcLabel,
      verified: false,
      pet: petBits.length || placeNote ? {
        acmpyPsblCpam: val(s.petSize) || val(s.petAllow),
        acmpyTypeCd: val(s.petAllow),
        acmpyNeedMtr: val(s.petLimit),
        etcAcmpyInfo: [placeNote, val(s.petFee) && `추가 요금: ${val(s.petFee)}`].filter(Boolean).join(", "),
        relaPosesFclty: val(s.petOnly),
        _raw: petBits.join(" / ")
      } : null,
      _hours: val(s.hours),
      _holiday: val(s.holiday),
      _category: val(s.category),
      _parking: val(s.parking),
      _fee: val(feeKey),
      _petFee: val(s.petFee),
      _desc: row["기본 정보_장소설명"] ? String(row["기본 정보_장소설명"]).trim() : "",
      _indoor: indoorV,
      _outdoor: outdoorV,
      _allow: val(s.petAllow)
    };
  }

  /* 문화정보원 카테고리2 정의 (실측 건수) */
  const CATEGORIES = {
    trip:    { cat: "반려동반여행",       label: "동반여행",     emoji: "✈️", count: 2742, typeId: "12" },
    cafe:    { cat: "반려동물식당카페",   label: "펫카페·식당",  emoji: "☕", count: 853,  typeId: "39" },
    service: { cat: "반려동물 서비스",    label: "펫서비스",     emoji: "🛁", count: 8276, typeId: "38" },
    medical: { cat: "반려의료",           label: "동물병원·약국", emoji: "🏥", count: 58778, typeId: "14" }
  };

  const Extra = {
    CATEGORIES,

    /** 문화정보원 시설 로드 — 카테고리2 + 시도로 서버측 필터 */
    async loadCulture({ catKey, sido = "", perPage = 1000, maxPages = 12, onPage } = {}) {
      const c = CATEGORIES[catKey];
      let all = [], schema = null, label = "한국문화정보원", matched = 0;
      for (let page = 1; page <= maxPages; page++) {
        const params = { page, perPage };
        if (c) params.cat = c.cat;
        if (sido) params.sido = sido;
        const json = await callApi("culture", params);
        label = json.label || label;
        const rows = json.data || [];
        matched = json.matchCount != null ? json.matchCount : (json.totalCount || 0);
        if (!rows.length) break;
        if (!schema) { schema = detectSchema(rows[0]); schemaCache.culture = schema; }
        const mapped = rows.map(r => toPlace(r, schema, label, (c && c.typeId) || "14"));
        all = all.concat(mapped.filter(p => !isNaN(p.mapx) && !isNaN(p.mapy)));
        if (onPage) onPage(all, matched);
        if (page * perPage >= matched) break;
      }
      return { items: all, schema, label, matched };
    },

    /** 동물병원 — 행안부 CSV를 좌표변환(EPSG:5174→WGS84)해 번들한 정적 데이터 */
    async loadVets() {
      const res = await fetch("data/vets.json");
      if (!res.ok) throw new Error("동물병원 데이터를 불러오지 못했습니다.");
      const rows = await res.json();
      return {
        // m: "c"=좌표 안내 가능, "a"=주소 검색으로만 안내 (구글 지도 기준 검증 완료)
        items: rows.map(v => ({ name: v.n, addr: v.a, tel: v.t || "", lat: v.y, lng: v.x, mode: v.m || "c" })),
        label: "행정안전부 동물병원(영업중)"
      };
    },

    /** 좌표를 못 믿는 장소용 — 거리 대신 같은 시군구 병원을 추린다 */
    vetsInArea(vets, place, limit = 3) {
      const gu = (place.addr || "").match(/([가-힣]+[시군구])/g) || [];
      const key = gu[gu.length - 1] || gu[0];
      if (!key) return [];
      return vets.filter(v => (v.addr || "").includes(key)).slice(0, limit);
    },

    /** 좌표가 있는 곳은 거리순, 모자라면 같은 시군구의 주소검색 전용 병원으로 보충 */
    nearestVets(vets, place, limit = 3) {
      const R = 6371, rad = Math.PI / 180;
      const withCoord = vets
        .filter(v => typeof v.lat === "number" && typeof v.lng === "number" && !isNaN(v.lat) && !isNaN(v.lng))
        .map(v => {
          const dLat = (v.lat - place.lat) * rad, dLng = (v.lng - place.lng) * rad;
          const h = Math.sin(dLat / 2) ** 2 + Math.cos(place.lat * rad) * Math.cos(v.lat * rad) * Math.sin(dLng / 2) ** 2;
          return { ...v, distKm: 2 * R * Math.asin(Math.sqrt(h)) };
        })
        .sort((a, b) => a.distKm - b.distKm)
        .slice(0, limit);
      if (withCoord.length >= limit) return withCoord;

      // 좌표가 없어 주소로만 안내되는 병원 → 같은 시군구에서 보충
      const gu = (place.addr || "").match(/([가-힣]+[시군구])/g) || [];
      const key = gu[gu.length - 1] || gu[0];
      if (!key) return withCoord;
      const byAddr = vets
        .filter(v => (typeof v.lat !== "number" || isNaN(v.lat)) && (v.addr || "").includes(key))
        .slice(0, limit - withCoord.length);
      return withCoord.concat(byAddr);
    },

    schemaCache,
    detectSchema
  };

  window.Extra = Extra;
})();
