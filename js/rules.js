/* ─────────────────────────────────────────────────────────────
 * 규정 해석 엔진 (지정과제 6: "조건 해석")
 * TourAPI detailPetTour 응답의 한국어 규정 텍스트를 구조화하고,
 * 사용자의 반려동물 프로필과 대조해 입장 가능 여부를 판정한다.
 *
 * petInfo 필드 (한국관광공사 반려동물 동반여행 서비스):
 *  - acmpyPsblCpam : 동반 가능 반려동물 (예: "개(소형견, 10kg 이하)")
 *  - acmpyTypeCd   : 동반 유형 (동반가능 / 부분동반 등)
 *  - acmpyNeedMtr  : 동반 시 필요사항 (예: "목줄 착용, 배변봉투 지참")
 *  - etcAcmpyInfo  : 기타 동반 정보 (예: "실외 테라스만 동반 가능")
 *  - relaPosesFclty / relaFrnshPrdlst / relaAcdntRiskMtr 등
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  const T = (k, v) => window.T(k, v);
  /* 크기 라벨·구간은 언어에 따라 달라진다 → 접근 시점에 번역을 읽는 getter로 둔다
   * (기존 호출부의 R.SIZE_LABEL[size] 표기를 그대로 유지하기 위함) */
  const SIZE_LABEL = {}, SIZE_RANGE = {};
  ["small", "medium", "large"].forEach(k => {
    Object.defineProperty(SIZE_LABEL, k, { get: () => T("size." + k), enumerable: true });
    Object.defineProperty(SIZE_RANGE, k, { get: () => T("size." + k + ".range"), enumerable: true });
  });

  /** 몸무게(kg) → 크기 구분
   *  기준: 소형견 10kg 미만 / 중형견 10kg 이상 ~ 25kg / 대형견 25kg 이상
   *  (예: 시츄·말티즈=소형, 웰시코기·비글·진돗개=중형, 골든리트리버·허스키=대형) */
  function sizeFromWeight(kg) {
    if (kg < 10) return "small";
    if (kg < 25) return "medium";
    return "large";
  }

  /** 규정 텍스트 묶음 → 구조화된 규칙 객체 */
  function parseRules(pet) {
    if (!pet) return { known: false };
    const all = [
      pet.acmpyPsblCpam, pet.acmpyTypeCd, pet.acmpyNeedMtr,
      pet.etcAcmpyInfo, pet.relaAcdntRiskMtr, pet.relaPosesFclty
    ].filter(Boolean).join(" / ");
    if (!all.trim()) return { known: false };

    // 입마개: "맹견은 입마개", "입질이 있는 경우 입마개" 등 조건부 문장은 전체 필수로 보지 않는다
    const muzzleClauses = all.split(/[,./·]/).filter(s => /입마개/.test(s));
    const muzzleRequired = muzzleClauses.some(s => !/(맹견|입질|짖|공격|사나|경우|시\s)/.test(s));

    // 케이지/유모차: "케이블카 탑승 시", "~한 경우" 등 특정 상황 한정 문구는 전면 필수로 보지 않는다
    const cageClauses = all.split(/[,./·]/).filter(s => /케이지|이동장|이동 ?가방|유모차|캐리어/.test(s));
    const cageRequired = cageClauses.some(s => /(필수|이용|지참|해야|필요)/.test(s) && !/(경우|탑승|권장)/.test(s));

    // 안내견·보조견 "만" 허용되는 곳: 일반 반려동물은 동반 불가로 판정
    const cpam = String(pet.acmpyPsblCpam || "");
    const guideDogOnly = /안내견|보조견|장애인\s*도우미견/.test(cpam) &&
      !/(반려견|반려동물|전\s*견종|모든|소형|중형|대형|고양이|강아지|펫)/.test(cpam);

    // 문화정보원 '반려동물 동반 가능정보' = Y/N 플래그
    const allowFlag = String(pet.acmpyTypeCd || "").trim().toUpperCase();
    const flagDenied = allowFlag === "N";

    const r = {
      known: true,
      raw: all,
      guideDogOnly,
      banned: (/동반\s*불가|출입\s*금지|입장\s*불가/.test(all) && !/실내|내부|일부|구역|경우|외\s/.test(all)) || guideDogOnly || flagDenied,
      weightLimitKg: null,
      allowedSizes: [],          // 비어 있으면 크기 제한 없음
      leashRequired: /목줄|리드줄|리드 줄|하네스/.test(all),
      muzzleRequired,
      cageRequired,
      vaccineRequired: /예방접종|백신|접종\s*증명/.test(all),
      // "실외 테라스 좌석만", "야외 정원 좌석만", "펫 존에서만" — 키워드 바로 뒤에 '만/한정'이 붙는 경우만
      outdoorOnly: /(실외|야외|테라스|펫\s*존)[^,./]{0,14}(만|에서만|한정)/.test(all),
      indoorBanned: /(실내|내부|매장\s*안|매장\s*내)[^,./]{0,10}(불가|금지|제한)/.test(all),
      poopBag: /배변\s*봉투|배변봉투|배변 처리|배변\s*수거/.test(all),
      dangerousBreedBan: /맹견/.test(all)
    };

    // 몸무게 제한: "10kg 이하", "7키로 미만" 등
    const w = all.match(/(\d+(?:\.\d+)?)\s*(?:kg|㎏|키로|킬로)\s*(이하|미만|까지|이내)/i);
    if (w) r.weightLimitKg = parseFloat(w[1]);

    // 문화정보원 데이터 표기 흡수: "모두 가능", "제한사항 없음", "해당없음"
    const sizeField = String(pet.acmpyPsblCpam || "");
    if (/모두\s*가능|전체\s*가능|크기\s*무관/.test(sizeField)) r.allSizesOk = true;
    if (/제한사항\s*없음|제한\s*없음/.test(all)) r.noRestriction = true;

    // 크기 제한: "소형견만", "소형·중형 가능", "대형견 불가"
    const hasSmall = /소형/.test(all), hasMedium = /중형/.test(all), hasLarge = /대형/.test(all);
    const largeBan = /대형[^가-힣]{0,4}(견)?[^가-힣]{0,4}(불가|금지|제한|어렵)/.test(all);
    if (hasSmall || hasMedium || hasLarge) {
      if (hasSmall) r.allowedSizes.push("small");
      if (hasMedium) r.allowedSizes.push("medium");
      if (hasLarge && !largeBan) r.allowedSizes.push("large");
      // "중형견 이하" → 소형 포함, "대형견 이하/까지" → 사실상 전 크기
      if (/중형(견)?[^가-힣]{0,8}(이하|까지)/.test(all) && !r.allowedSizes.includes("small")) r.allowedSizes.push("small");
      if (/대형(견)?[^가-힣]{0,8}(이하|까지)/.test(all)) r.allowedSizes = [];
      // "전 견종", "모든 반려견"이면 제한 해제
      if (/전\s*견종|모든\s*반려|견종\s*무관|크기\s*무관/.test(all)) r.allowedSizes = [];
    }
    // "모두 가능"이면 크기·무게 제한 해제 (문화정보원 표준 표기)
    if (r.allSizesOk) { r.allowedSizes = []; r.weightLimitKg = null; }
    return r;
  }

  /**
   * 판정: profile(내 반려동물) × rules(장소 규정)
   * @returns {status: 'ok'|'cond'|'no'|'unknown', reasons: string[], checklist: string[]}
   */
  function judge(profile, rules) {
    const checklist = buildChecklist(rules);
    if (!rules || !rules.known) {
      return { status: "unknown", reasons: [T("jd.unknown")], checklist };
    }
    if (rules.banned) {
      return {
        status: "no",
        reasons: [T(rules.guideDogOnly ? "jd.guideOnly" : "jd.banned")],
        checklist: []
      };
    }
    // 프로필이 없어도 규정 자체로 1차 판정 (설정 전에도 가능/불가는 보여준다)
    if (!profile) {
      const hasSizeRule = rules.weightLimitKg != null || rules.allowedSizes.length > 0;
      const needsGear = rules.leashRequired || rules.cageRequired || rules.muzzleRequired || rules.vaccineRequired;
      const notes = [];
      if (hasSizeRule) {
        notes.push(rules.weightLimitKg != null
          ? T("jd.weightRule", { n: rules.weightLimitKg })
          : T("jd.sizeRule", { s: rules.allowedSizes.map(s => SIZE_LABEL[s]).join("·") }));
      }
      if (rules.outdoorOnly || rules.indoorBanned) notes.push(T("jd.indoorLimit"));
      notes.push(T("jd.setProfile"));
      return { status: (hasSizeRule || needsGear) ? "cond" : "ok", reasons: notes, checklist };
    }

    const reasons = [];
    let status = "ok";
    const size = profile.size === "auto" ? sizeFromWeight(profile.weightKg) : profile.size;

    // 1) 하드 컷: 몸무게·크기 → 불가
    if (rules.weightLimitKg != null && profile.weightKg > rules.weightLimitKg) {
      status = "no";
      reasons.push(T("jd.overWeight", { limit: rules.weightLimitKg, mine: profile.weightKg }));
    }
    if (rules.allowedSizes.length && !rules.allowedSizes.includes(size)) {
      status = "no";
      reasons.push(T("jd.overSize", {
        s: rules.allowedSizes.map(s => SIZE_LABEL[s]).join("·"), mine: SIZE_LABEL[size]
      }));
    }
    if (status === "no") return { status, reasons, checklist };

    // 2) 조건부: 준비물 미지참 → cond
    if (rules.leashRequired && !profile.hasLeash) { status = "cond"; reasons.push(T("jd.needLeash")); }
    if (rules.cageRequired && !profile.hasCage) { status = "cond"; reasons.push(T("jd.needCage")); }
    if (rules.muzzleRequired && !profile.hasMuzzle) { status = "cond"; reasons.push(T("jd.needMuzzle")); }
    if (rules.vaccineRequired && !profile.vaccinated) { status = "cond"; reasons.push(T("jd.needVaccine")); }

    // 3) 안내 사항 (판정 등급은 유지)
    if (rules.outdoorOnly || rules.indoorBanned) reasons.push(T("jd.outdoorOnly"));
    if (rules.dangerousBreedBan) reasons.push(T("jd.dangerBreed"));
    if (status === "ok" && !reasons.length) reasons.push(T("jd.allGood"));
    return { status, reasons, checklist };
  }

  /** 규정 → 방문 전 준비물 체크리스트 자동 생성 (헛걸음 방지) */
  function buildChecklist(rules) {
    const list = [];
    if (!rules || !rules.known) {
      return [T("ck.callFirst"), T("ck.leash"), T("ck.poop")];
    }
    if (rules.leashRequired) list.push(T("ck.leash2"));
    if (rules.cageRequired) list.push(T("ck.cage"));
    if (rules.muzzleRequired) list.push(T("ck.muzzle"));
    if (rules.vaccineRequired) list.push(T("ck.vaccine"));
    if (rules.poopBag) list.push(T("ck.poop"));
    if (rules.weightLimitKg != null) list.push(T("ck.weight", { n: rules.weightLimitKg }));
    if (rules.outdoorOnly || rules.indoorBanned) list.push(T("ck.outdoor"));
    if (!list.length) list.push(T("ck.leash"), T("ck.poop"));
    return list;
  }

  /** 규정 카드 표시용 key-value 목록 */
  function ruleCards(pet) {
    if (!pet) return [];
    // 문화정보원 데이터는 동반 유형이 Y/N 플래그로 들어온다 → 한글로 표기
    const typeRaw = String(pet.acmpyTypeCd || "").trim();
    const typeLabel = typeRaw.toUpperCase() === "Y" ? T("rc.yes")
      : typeRaw.toUpperCase() === "N" ? T("rc.no") : typeRaw;

    const map = [
      [T("rc.animals"), pet.acmpyPsblCpam],
      [T("rc.type"), typeLabel],
      [T("rc.need"), pet.acmpyNeedMtr],
      [T("rc.etc"), pet.etcAcmpyInfo],
      [T("rc.fclty"), pet.relaPosesFclty],
      [T("rc.frnsh"), pet.relaFrnshPrdlst],
      [T("rc.rental"), pet.relaRntlPrdlst],
      [T("rc.purchase"), pet.relaPurcPrdlst],
      [T("rc.risk"), pet.relaAcdntRiskMtr]
    ];
    // "해당없음/정보없음" 같은 빈 표기는 카드에서 제외
    return map.filter(([, v]) => v && String(v).trim() && !/^(해당없음|정보없음|없음|-)$/.test(String(v).trim()));
  }

  window.PetRules = { parseRules, judge, buildChecklist, ruleCards, sizeFromWeight, SIZE_LABEL, SIZE_RANGE };
})();
