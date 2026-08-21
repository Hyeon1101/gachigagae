/* ─────────────────────────────────────────────────────────────
 * 다국어 (한국어 / English)
 *
 *  · 정적 마크업 : data-i18n(텍스트) / data-i18n-html / data-i18n-ph(placeholder)
 *                  / data-i18n-title / data-i18n-aria 속성을 훑어 채운다.
 *  · 동적 문자열 : window.T("key", {변수})  — app.js / rules.js / tips.js / ai.js
 *  · 언어를 바꾸면 apply() 후 "petmap:lang" 이벤트를 던져 각 화면이 다시 그린다.
 *
 *  공공데이터 본문(장소명·주소·규정 원문·퀴즈 지문)은 한국관광공사·문화정보원이
 *  한국어로만 제공하므로 원문 그대로 둔다. UI와 판정 문구가 번역 대상이다.
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  const KO = {
    /* ── 상단바 ── */
    "nav.home": "홈", "nav.list": "목록", "nav.map": "지도", "nav.tips": "반려동물 팁",
    "top.mypet": "내 반려동물",
    "top.langBtn": "English",
    "top.langTitle": "Switch to English",
    "top.regionTitle": "지역 바꾸기",
    "doc.title": "같이가개 — 반려동물 동반 여행 가이드",

    /* ── 데모 배너 ── */
    "demo.text": "<b>데모 모드</b> — 공공데이터 연결 전이라 샘플을 표시 중입니다.",

    /* ── 히어로 ── */
    "hero.eyebrowA": "공공데이터",
    "hero.eyebrowB": "곳 · 출입 규정 자동 판정",
    // <br> 앞뒤의 공백은 웹에서는 줄바꿈에 흡수돼 보이지 않고, 앱에서 <br> 를
    // 감췄을 때(한 줄 배너) 낱말이 붙어 버리는 것을 막아 준다.
    "hero.title": "반려동물과 <br> 떠나는 <br> 행복한 하루",
    "hero.lead": "어디든 같이가개! 반려동물 입장 가능한 곳만 모아 알려드려요.",
    "hero.ph": "예) 소형견이랑 갈 만한 서울 실내 카페 알려줘",
    "hero.search": "검색",
    "ex.1": "대형견 제주 관광지",
    "ex.2": "서울 실내 식당",
    "ex.3": "경기 동반 펜션",
    "ex.4": "시츄 주의사항",
    "ex.reset": "초기화",
    "ex.resetTitle": "검색 조건을 모두 지우고 처음 상태로",
    "guide.hello": "안녕! 나는 여행 도우미 <b>가개</b>야<br>어디로 갈지 물어보면 딱 맞는 곳을 찾아줄게!",

    /* ── 지역 빠른 선택 ── */
    "region.eyebrow": "REGION",
    "region.title": "지역 먼저 고르기",
    "region.sub": "고른 지역이 목록 · 지도 · 아래 핫플레이스에 한 번에 적용돼요",
    "region.now": "지금 보는 지역",
    "region.pick": "지역 선택",
    "region.done": "지역을 {area}(으)로 바꿨어! 🐾 목록과 아래 핫한 곳도 같이 바뀌었어.",

    /* ── 홈 패널 ── */
    "panel.mypet": "MY PET",
    "panel.mypetTitle": "가개가 정리한 내 정보",
    "panel.editInfo": "내 정보 수정",
    "panel.today": "TODAY",
    "panel.todayTitle": "오늘의 반려동물 상식",
    "panel.nextTip": "다른 상식",
    "panel.quiz": "퀴즈 풀기",

    /* ── 반려동물 정보 폼 ── */
    "pf.title": "내 반려동물 정보 등록",
    "pf.cardTitle": "우리 아이 정보",
    "pf.sub": "우리 아이 맞춤 출입 규정 자동 판정 및 헛걸음 방지",
    "pf.stateEmpty": "정보 미입력",
    "pf.breedLabel": "품종으로 자동 입력",
    "pf.aiChip": "AI 자동 분류",
    "pf.breedPh": "예: 시츄, 골든리트리버, 코리안숏헤어",
    "pf.breedBtn": "품종 분류",
    "pf.name": "이름", "pf.namePh": "예: 콩이",
    "pf.species": "종류", "pf.dog": "강아지", "pf.cat": "고양이", "pf.other": "기타",
    "pf.weight": "몸무게 (kg)",
    "pf.size": "크기 구분",
    "pf.sizeAuto": "몸무게로 자동 판정",
    "pf.small": "소형견 (10kg 미만)",
    "pf.medium": "중형견 (10 ~ 25kg)",
    "pf.large": "대형견 (25kg 이상)",
    "pf.gear": "지참 가능한 준비물",
    "pf.leash": "목줄/리드줄 (2m 이내)",
    "pf.cage": "케이지/이동가방/유모차",
    "pf.muzzle": "입마개",
    "pf.vaccine": "예방접종 완료",
    "pf.save": "정보 저장 및 맞춤 장소 판정하기",

    /* ── 카테고리 ── */
    "cat.eyebrow": "CATEGORY",
    "cat.title": "카테고리로 찾기",
    "cat.subA": "전국",
    "cat.subB": "곳",
    "cat.count": "{n}곳",
    "cat.able": "{n}곳 가능",

    /* ── 퀴즈 밴드 ── */
    "band.eyebrow": "QUIZ · 105문항",
    "band.title": "아는 만큼<br>안전해집니다",
    "band.text": "위생 · 예방접종 · 위험한 음식까지, O/X 열 문제로 우리 아이 지키기.",
    "band.cta": "퀴즈 풀어 보기",

    /* ── 출처 ── */
    "src.eyebrow": "SOURCE",
    "src.title": "활용 공공데이터",
    "src.1n": "9,764곳", "src.1b": "한국관광공사", "src.1s": "반려동물 동반여행 서비스",
    "src.2n": "70,650곳", "src.2b": "한국문화정보원", "src.2s": "반려동물 동반 가능 시설",
    "src.3n": "5,038곳", "src.3b": "행정안전부", "src.3s": "전국 동물병원 · 전수조사로 오류 406곳 삭제",
    "src.foot": "같이가개 · 2026 관광데이터 활용 공모전 출품작",

    /* ── 핫플레이스 파노라마 ── */
    "hot.eyebrow": "HOT NOW",
    "hot.title": "핫한 곳",
    "hot.pattern": "{area} {cat} 핫한 곳",
    "hot.sub": "네이버 방문자 평점이 높은 순 · 지역과 카테고리를 바꿔 보세요",
    "hot.loading": "평점 높은 곳을 찾는 중…",
    "hot.none": "이 조건에서는 평점 정보를 찾지 못했어요. 지역이나 카테고리를 바꿔 보세요.",
    "hot.noRate": "평점 미등록",
    "hot.review": "리뷰 {n}",
    "hot.open": "상세 보기",
    "hot.refresh": "다시 찾기",
    "hot.hint": "카드를 누르면 규정·체크리스트까지 볼 수 있어요",

    /* ── 목록 ── */
    "res.title": "목록",
    "res.searchPh": "이름·주소 검색",
    "res.fitOnly": "입장 가능만",
    "res.reSearch": "AI 다시 검색",
    "res.reSearchTitle": "AI에게 다시 물어보기",
    "res.reset": "초기화",
    "res.resetTitle": "검색어·필터를 지우고 처음 상태로",
    "res.toMap": "지도로 보기",
    "res.areaTitle": "지역 선택",
    "res.loading": "데이터 불러오는 중…",
    "res.empty": "조건에 맞는 장소가 없습니다.<br>지역·필터를 변경해 보세요.",
    "res.more": "더보기 ({a} / {b})",
    "res.registered": "등록 <b>{n}</b>곳",
    "res.loadingMore": " · 불러오는 중 {n}곳…",
    "res.filtered": " · 필터 {n}곳",
    "res.okCount": "동반가능 {n}",
    "res.noCount": "불가 {n}",

    /* ── 지도 ── */
    "map.ok": "입장 가능", "map.cond": "조건부", "map.no": "불가", "map.unknown": "확인 필요",
    "map.title": "지도", "map.toList": "목록으로", "map.src": "지도: ",

    /* ── 팁·퀴즈 ── */
    "tips.eyebrow": "QUIZ & TIPS",
    "tips.title": "반려동물 상식 퀴즈",
    "tips.leadA": "강아지 · 고양이 · 예방접종 · 위험한 음식 · 기초 상식 · 기분 신호까지",
    "tips.leadB": "을 O/X로 확인해 보세요.",
    "tips.listTitle": "알아두면 좋은 상식",
    "tips.listSub": "위생 · 청결 · 안전 · 잘못된 상식",
    "tips.note": "건강·접종 관련 내용은 일반적인 안내이며, 우리 아이에게 맞는 판단은 수의사와 상담해 주세요.",
    "tips.total": "총 {n}문항",
    "tips.koOnly": "",

    /* ── AI 모달 ── */
    "ai.bubble": "어디로 갈지 물어봐! 우리 아이가 갈 수 있는 곳만 골라 줄게.",
    "ai.ph2": "다시 물어보기 — 새 질문을 입력하세요",
    "ai.send": "보내기",
    "ai.reset": "처음부터 다시 검색",
    "ai.foot": "Google Gemini로 검색 조건을 해석합니다",
    "ai.close": "닫기",
    "ai.dragClose": "아래로 내리면 닫혀요",

    /* ── 지역명 ── */
    "area.": "전국",
    "area.1": "서울", "area.2": "인천", "area.3": "대전", "area.4": "대구", "area.5": "광주",
    "area.6": "부산", "area.7": "울산", "area.8": "세종", "area.31": "경기", "area.32": "강원",
    "area.33": "충북", "area.34": "충남", "area.35": "경북", "area.36": "경남",
    "area.37": "전북", "area.38": "전남", "area.39": "제주",
    "area.long.33": "충청북도", "area.long.34": "충청남도", "area.long.35": "경상북도",
    "area.long.36": "경상남도", "area.long.37": "전라북도", "area.long.38": "전라남도",

    /* ── 카테고리명 ── */
    "type.39": "식당·카페", "type.12": "관광지", "type.38": "쇼핑·편의", "type.32": "숙박",
    "type.28": "레포츠", "type.14": "문화·공공",
    "type.culture:medical": "병원·약국", "type.culture:service": "펫서비스",
    "type.culture:trip": "동반여행", "type.culture:cafe": "펫카페·식당",
    "type.none": "카테고리 미선택",

    /* ── 판정 ── */
    "st.ok": "입장 가능", "st.cond": "조건부 가능", "st.no": "입장 불가", "st.unknown": "규정 확인 필요",
    "size.small": "소형", "size.medium": "중형", "size.large": "대형",
    "size.small.range": "10kg 미만", "size.medium.range": "10 ~ 25kg", "size.large.range": "25kg 이상",
    "unit.dog": "견",

    /* ── 규정 배지 ── */
    "rb.none": "규정 정보 없음",
    "rb.weight": "{n}kg 이하",
    "rb.sizes": "{s}만",
    "rb.leash": "목줄 필수",
    "rb.cage": "케이지/유모차",
    "rb.muzzle": "입마개",
    "rb.outdoor": "실외만",
    "rb.vaccine": "접종 증명",
    "rb.official": "공식 데이터",
    "rb.verified": "규정 확인 완료",
    "rb.sample": "확인 전(샘플)",

    /* ── 판정 사유 (rules.js) ── */
    "jd.unknown": "등록된 동반 규정 정보가 없습니다. 방문 전 전화 확인을 권장합니다.",
    "jd.guideOnly": "이 장소는 시각장애인 안내견 등 보조견만 동반 가능한 곳입니다. 일반 반려동물은 입장할 수 없습니다.",
    "jd.banned": "이 장소는 반려동물 동반이 불가능한 곳으로 안내되어 있습니다.",
    "jd.weightRule": "몸무게 제한: {n}kg 이하",
    "jd.sizeRule": "크기 제한: {s}만 가능",
    "jd.indoorLimit": "실내 출입 제한 — 실외 공간만 동반 가능",
    "jd.setProfile": "🐶 [내 반려동물 설정]을 입력하면 내 아이 기준으로 정밀 판정해 드려요.",
    "jd.overWeight": "몸무게 제한 초과: 이 장소는 {limit}kg 이하만 가능 (내 반려동물 {mine}kg)",
    "jd.overSize": "크기 제한: {s}만 동반 가능 (내 반려동물: {mine})",
    "jd.needLeash": "목줄/리드줄 필수 — 준비물에 체크되어 있지 않습니다.",
    "jd.needCage": "케이지·이동가방·유모차 필수 — 준비물에 체크되어 있지 않습니다.",
    "jd.needMuzzle": "입마개 필수 — 준비물에 체크되어 있지 않습니다.",
    "jd.needVaccine": "예방접종 증명 필요 — 접종 여부를 확인해 주세요.",
    "jd.outdoorOnly": "실내 출입 제한 — 실외(테라스 등) 공간만 동반 가능합니다.",
    "jd.dangerBreed": "맹견(도사견·핏불테리어 등 5종)은 출입이 제한되거나 입마개가 필수입니다.",
    "jd.allGood": "입력하신 프로필 기준, 규정상 입장 가능한 조건입니다. 🎉",

    /* ── 체크리스트 ── */
    "ck.callFirst": "방문 전 전화로 동반 가능 여부 확인",
    "ck.leash": "목줄/리드줄",
    "ck.leash2": "목줄/리드줄 (2m 이내 권장)",
    "ck.poop": "배변봉투",
    "ck.cage": "케이지·이동가방 또는 유모차",
    "ck.muzzle": "입마개",
    "ck.vaccine": "예방접종 증명서 (동물등록증)",
    "ck.weight": "몸무게 확인 ({n}kg 이하)",
    "ck.outdoor": "실외석 이용 — 우천 시 대비",

    /* ── 규정 원문 카드 ── */
    "rc.animals": "동반 가능 동물", "rc.type": "동반 유형", "rc.need": "필수 준비사항",
    "rc.etc": "기타 동반 정보", "rc.fclty": "구비 시설", "rc.frnsh": "비치 물품",
    "rc.rental": "렌탈 가능 물품", "rc.purchase": "구매 가능 물품", "rc.risk": "사고 대비 사항",
    "rc.yes": "동반 가능", "rc.no": "동반 불가",

    /* ── 상세 패널 ── */
    "dt.loading": "불러오는 중…",
    "dt.gmap": "구글 지도 길안내", "dt.kakao": "카카오맵",
    "dt.routeKakao": "카카오맵 길찾기",
    "dt.gmapView": "구글 지도에서 보기",
    "dt.geoSuspect": "공개된 좌표가 주소와 맞지 않아 이름·주소로 검색해 안내합니다.",
    "dt.rating": "평점·후기 확인 중…",
    "dt.noRating": "네이버에 등록된 평점·후기를 찾지 못했습니다. 방문 전 전화 확인을 권장해요.",
    "dt.visitorReview": "방문자 리뷰 {n}",
    "dt.blog": "블로그 {n}",
    "dt.moreNaver": "네이버 플레이스에서 후기 더 보기",
    "dt.rules": "동반 규정 (원문)",
    "dt.noRules": "등록된 규정 정보가 없습니다. {tel}",
    "dt.callTel": "{tel} 로 확인해 주세요.",
    "dt.checkBefore": "방문 전 확인해 주세요.",
    "dt.source": "출처: ",
    "dt.callWarn": " — <b>방문 전 전화 확인 권장</b>",
    "dt.checklist": "방문 전 체크리스트 (헛걸음 방지)",
    "dt.nearby": "근처 반려동물 동반 관광지",
    "dt.nearbyNear": "가까운 순",
    "dt.nearbyRadius": "반경 {n}km",
    "dt.nearbyNone": "반경 내 등록된 동반 가능 관광지가 없습니다.",
    "dt.nearbyRule": "규정은 상세에서 확인",
    "dt.vets": "근처 동물병원",
    "dt.vetsSub": "여행 중 응급 대비",
    "dt.vetsLoading": "동물병원 정보 불러오는 중…",
    "dt.vetsNone": "이 지역에 등록된 동물병원 정보가 없습니다.",
    "dt.vetsFallback": "공공데이터 연동 준비 중이라 지도 검색으로 안내합니다.",
    "dt.vetsSearch": "{area}동물병원 지도에서 찾기",
    "dt.vetQuery": "{area} 동물병원",
    "dt.facility": "시설 정보",
    "dt.detail": "상세", "dt.route": "길안내", "dt.detailRule": "상세·규정",
    "dt.close": "닫기",
    "dt.noAddr": "주소 정보 없음",
    "dt.allDog": "전 견종",
    "dt.outdoorShort": "실외만",
    "dt.leashShort": "목줄",

    /* ── 시설 정보 키 ── */
    "fi.hours": "운영시간", "fi.holiday": "휴무일", "fi.parking": "주차",
    "fi.fee": "입장·이용료", "fi.petFee": "반려동물 추가요금", "fi.space": "공간",
    "fi.yes": "가능", "fi.no": "불가",
    "fi.indoor": "실내", "fi.outdoor": "실외", "fi.both": "실내·실외",

    /* ── 마스코트 대사 ── */
    "ms.head": "🐾 <b>{area} {cat}</b> {n}곳 중",
    "ms.cultureProfile": "{head} <b>{able}곳</b>에 우리 아이가 갈 수 있어! (불가 {no}곳)",
    "ms.cultureNoProfile": "{head} <b>{able}곳</b>이 동반 가능해. 프로필을 넣으면 내 아이 기준으로 딱 맞춰 줄게!",
    "ms.tour": "{head} <b>{able}곳</b>이 동반 가능 등록 장소야. 눌러 보면 세부 조건까지 알려줄게!",
    "ms.reset": "검색을 초기화했어! 🐾 다시 물어보거나 아래 카테고리에서 골라 봐.",
    "ms.saved": "✅ <b>{name}</b>({kg}kg · {size}{unit} · {range}) 정보 저장 완료!<br>이제 이 아이 기준으로 갈 수 있는 곳만 골라 줄게 🐾",

    /* ── 문화정보원 미연결 안내 ── */
    "ex.noData": "<b>반려동물 시설 데이터 미연결</b>",
    "ex.how": "<b>연결 방법</b>",
    "ex.step1": "공공데이터포털에서 활용신청",
    "ex.step1s": " (무료·즉시)",
    "ex.step2": "② 승인 후 새로고침하면 <b>70,650곳</b>이 자동 표시됩니다",
    "ex.step3": "※ 기존 인증키를 그대로 사용하므로 새 키는 필요 없습니다",

    /* ── 홈 요약 카드 (tips.js) ── */
    "in.pet": "우리 아이", "in.gear": "준비물", "in.none": "없음",
    "in.empty": "아직 반려동물 정보가 없어요.<br><span>입력하면 장소마다 <b>우리 아이 기준</b>으로 입장 가능 여부를 판정해 드려요.</span>",
    "in.watching": "지금 보는 곳",
    "in.stat": "곳 동반 가능<br><small>불러온 {loaded}곳 중{no}</small>",
    "in.statNo": " · 불가 {n}곳",
    "in.hint": "카테고리를 고르면 우리 아이가 갈 수 있는 곳 수를 세어 드릴게요.",
    "in.quiz": "상식 퀴즈",
    "in.quizScore": "{right} / {done}문제 정답",
    "in.quizNone": "아직 안 풀었어요",

    /* ── 퀴즈 (tips.js) ── */
    "qz.all": "전체", "qz.random": "랜덤 {n}",
    "qz.noQuestion": "문제를 준비하지 못했어요.",
    "qz.doneT": "{cat} 퀴즈 완료!",
    "qz.randomCat": "랜덤",
    "qz.doneS": "{right} / {total}문제 정답",
    "qz.doneN": "전체 {all}문항 중 {round}문항이 무작위로 나와요. 다시 풀면 다른 문제가 나옵니다.",
    "qz.w100": "전부 맞혔어요. 우리 아이 집사 자격 충분해요!",
    "qz.w70": "잘 알고 있어요! 틀린 해설만 다시 읽어 보면 완벽해요.",
    "qz.w0": "해설을 천천히 읽어 보면 헛걸음도 사고도 크게 줄어요.",
    "qz.restart": "다시 풀기",
    "qz.yes": "맞아요", "qz.no": "아니에요",
    "qz.right": "정답이에요!", "qz.wrong": "아쉬워요",
    "qz.answer": "정답: {a}",
    "qz.ansO": "O 맞아요", "qz.ansX": "X 아니에요",
    "qz.next": "다음 문제", "qz.result": "결과 보기",
    "qz.first": "첫 문제를 풀어 보세요",
    "qz.confirm": "지금까지 푼 <b>{n}문제</b> 기록을<br>모두 지울까요?",
    "qz.confirmYes": "초기화", "qz.confirmNo": "취소",
    "qz.cum": "누적 정답 · {pct}%",
    "qz.share": "결과 자랑하기", "qz.resetScore": "기록 초기화",
    "qz.sharePanel": "지금까지 푼 기록 자랑하기",
    "qz.shareTitle": "결과 자랑하기",

    /* ── 공유 (tips.js) ── */
    "sh.copyFb": "문구를 복사해 뒀어요. 페이스북 글 작성창에 붙여 넣어 주세요.",
    "sh.copyFbManual": "아래 문구를 직접 복사해 페이스북 글 작성창에 붙여 넣어 주세요.",
    "sh.copied": "결과 문구와 링크를 복사했어요. 원하는 곳에 붙여 넣어 주세요.",
    "sh.copyManual": "자동 복사가 막혀 있어요. 아래 문구를 직접 복사해 주세요.",
    "sh.making": "결과 카드 이미지를 만드는 중…",
    "sh.igOk": "결과 카드 이미지를 저장했어요. 인스타그램에 올린 뒤 <b>복사해 둔 문구</b>를 붙여 넣으면 끝!",
    "sh.igManual": "결과 카드 이미지를 저장했어요. 아래 문구를 복사해 인스타그램에 함께 올려 주세요.",
    "sh.igFail": "이미지를 만들지 못했어요. 화면을 캡처해 공유해 주세요.",
    "sh.grade100": "만점 집사", "sh.grade80": "베테랑 집사",
    "sh.grade60": "성장 중인 집사", "sh.grade0": "공부 중인 집사",
    "sh.tipLabel": "반려동물 상식",
    "sh.cumTitle": "누적 퀴즈 기록",
    "sh.roundTitle": "{label} 퀴즈 결과",
    "sh.textCum": "같이가개 {label} 퀴즈를 지금까지 {total}문제 풀어서 {right}개 정답! ({pct}%) — {grade} 🐾",
    "sh.textRound": "같이가개 {label} 퀴즈에서 {total}문제 중 {right}개 정답! ({pct}%) — {grade} 🐾",
    "sh.textFoot": "우리 아이랑 갈 수 있는 곳도 찾아보세요.",
    "sh.copyBtn": "문구 복사",
    "img.brand": "같이가개",
    "img.sub": "반려동물 동반 여행 가이드",
    "img.rate": "정답률 {pct}%",
    "img.foot": "우리 아이가 갈 수 있는 곳, 조건까지 확인하고 가세요",

    /* ── AI (ai.js) ── */
    "aj.thinking": "<b>{q}</b><br>어떤 곳을 찾을지 생각하는 중이야…",
    "aj.searching": "공공데이터에서 찾는 중…",
    "aj.choosing": "{n}곳 중에서 고르는 중…",
    "aj.willFind": "찾아볼게!",
    "aj.fail": "데이터를 불러오지 못했어요: ",
    "aj.notFound": "<br>조건에 맞는 곳을 못 찾았어… 지역이나 조건을 바꿔서 다시 물어봐 줄래? 🥲",
    "aj.whyOk": "규정상 바로 입장할 수 있는 곳이야.",
    "aj.whyCond": "조건만 맞추면 함께 갈 수 있어.",
    "aj.whyUnknown": "동반 가능 장소로 등록돼 있어. 세부 규정은 상세에서 확인해 줘.",
    "aj.liveLoad": "평점·후기 확인 중…",
    "aj.liveNone": "네이버 등록 정보 없음 — 방문 전 전화 확인 권장",
    "aj.allList": "전체 목록", "aj.onMap": "지도에서 보기", "aj.again": "다시 검색",
    "aj.askAgain": "다른 곳도 찾아 줄까? 아래에 새로 물어봐! 🐾",
    "aj.analyzing": "<b>{b}</b> 분석 중…",
    "aj.stdTable": "표준 견종표",
    "aj.gemini": "Gemini AI",
    "aj.breedReply": "{name}은(는) {size}{unit}이야{range}! 이 기준으로 갈 수 있는 곳을 골라 줄게 🐾",
    "aj.dangerous": "맹견 지정", "aj.needMuzzle": "입마개 필수",
    "aj.noKey": "AI 기능이 아직 연결되지 않았어요.<br><span style=\"color:var(--ink-sub);font-size:12px;\">Netlify 환경변수 <b>GEMINI_API_KEY</b>를 설정한 뒤 재배포하면 바로 동작합니다.</span>",
    "aj.err": "AI 응답을 받지 못했어요 🥲<br>",
    "aj.sizeSmall": "소형견", "aj.sizeMedium": "중형견", "aj.sizeLarge": "대형견",
    "aj.indoor": "실내",
    "aj.nameExample": "예: 우리 {name}",
    "aj.searchResult": "AI 검색 결과",

    /* ── 따라다니는 도우미 ── */
    "bd.hello": "안녕! 나는 여행 도우미 <b>가개</b>야. 화면을 따라다니면서 안내할게 🐾",
    "bd.offHint": "안내가 불편하면 아래 <b>안내 끄기</b>를 누르면 돼요. 소리만 끄는 것도 가능하고, 언제든 다시 켤 수 있어요.",
    "bd.searching": "<b>딱 맞는 곳</b>을 찾으러 달려가는 중… 멍멍!",
    "bd.found": "다 찾았어! 추천한 곳부터 확인해 봐 🐾",
    "bd.back": "다시 왔어! 옆에서 안내할게 🐾",
    "bd.dogTitle": "가개를 누르면 다음 안내를 알려줘요",
    "bd.ask": "그 화면으로 갈까요?",
    "bd.goYes": "연결하기",
    "bd.goNo": "아니요",
    "bd.off": "안내 끄기",
    "bd.offTitle": "도우미를 숨깁니다 — 오른쪽 아래 버튼으로 언제든 다시 켤 수 있어요",
    "bd.on": "도우미 켜기",
    "bd.onTitle": "가개 도우미를 다시 표시합니다",
    "bd.tip1": "🐶 <b>내 반려동물 정보</b>를 등록하면 장소마다 입장 가능 여부를 판정해줘!",
    "bd.tip2": "🎒 상세 화면의 <b>체크리스트</b>만 챙기면 헛걸음 끝!",
    "bd.tip3": "📞 <b>확인 필요</b> 배지가 붙은 곳은 방문 전에 전화해 보는 게 안전해.",
    "bd.tip4": "🗺️ 상세 화면의 <b>길안내</b>를 누르면 카카오맵 길찾기로 바로 연결돼!",
    "bd.tip5": "📍 상단의 <b>지역 버튼</b>을 바꾸면 목록·지도·핫플레이스가 한 번에 바뀌어.",
    "bd.tip6": "🔎 검색창에 <b>말하듯이</b> 물어봐. 예) 소형견이랑 갈 서울 실내 카페!",
    "bd.page.home": "🏠 홈이야! 검색창에 물어보면 딱 맞는 곳을 찾아줄게.",
    "bd.page.results": "📋 목록이야. <b>입장 가능만</b> 체크하면 확실한 곳만 남아!",
    "bd.page.map": "🗺️ 지도야! 핀 색으로 입장 가능 여부를 한눈에 볼 수 있어.",
    "bd.page.tips": "🐾 퀴즈로 반려동물 상식을 확인해 봐!",

    /* ── 📍 내 위치 ── */

    /* ── ❤️ 즐겨찾기 ── */
    "wc.title": "같이가개",
    "wc.lead": "로그인하면 마음에 든 곳을 즐겨찾기에 저장할 수 있어요.",
    "wc.skip": "로그인 없이 사용하기",
    "wc.note": "검색 · 지도 · 퀴즈는 로그인 없이도 전부 쓸 수 있어요.",
    "sh.share": "공유",
    "sh.kakao": "카카오톡",
    "sh.insta": "인스타그램",
    "sh.x": "X",
    "sh.via": "— 같이가개에서 찾았어요",
    "sh.appText": "반려동물이랑 갈 수 있는 곳, 같이가개에서 찾아보세요!",
    "sh.instaCopied": "문구를 복사했어요. 인스타그램에 붙여넣어 주세요!",
    "sh.kakaoBtn": "같이가개에서 보기",
    "sh.kakaoFallback": "카카오톡 공유창을 열지 못했어요. 문구를 복사했으니 붙여 넣어 주세요.",
    "sh.copied": "문구를 복사했어요.",
    "sh.copyFail": "복사하지 못했어요. 화면을 길게 눌러 직접 복사해 주세요.",
    "fav.title": "즐겨찾기",
    "fav.btnTitle": "저장한 장소 보기",
    "fav.add": "즐겨찾기에 저장",
    "fav.remove": "즐겨찾기에서 빼기",
    "fav.added": "즐겨찾기에 저장했어요",
    "fav.removed": "즐겨찾기에서 뺐어요",
    "fav.empty": "아직 저장한 곳이 없어요.<br>장소 카드의 <b>하트</b>를 누르면 여기에 모입니다.",
    "fav.count": "{n}곳 저장됨",
    "fav.open": "상세",
    "fav.route": "길찾기",
    "fav.clear": "전체 비우기",
    "fav.clearAsk": "저장한 즐겨찾기를 모두 지울까요?",
    "fav.guestNote": "즐겨찾기는 구글 로그인 후 사용할 수 있어요.",
    "fav.needLogin": "즐겨찾기는 구글 로그인 후 사용할 수 있어요.",
    "fav.openList": "목록에서 보기",
    "fav.backToAll": "전체 목록으로",
    "fav.loginEmpty": "구글 로그인을 하면 마음에 든 곳을 저장할 수 있어요.<br>저장한 곳은 이 계정에만 남습니다.",
    "fav.userNote": "{name} 계정으로 저장 중",

    /* ── 🔐 구글 로그인(선택) ── */
    "acc.signIn": "Google로 로그인",
    "acc.signInTitle": "로그인하면 즐겨찾기를 쓸 수 있어요 (검색·지도·퀴즈는 로그인 없이도 그대로)",
    "acc.signOut": "로그아웃",
    "acc.guest": "게스트",
    "acc.optional": "즐겨찾기만 로그인이 필요해요. 검색·지도·퀴즈는 로그인 없이 그대로 씁니다.",
    "acc.failed": "로그인을 마치지 못했어요. 잠시 후 다시 시도해 주세요.",
    "acc.noNet": "인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
    "acc.blocked": "지금은 구글 로그인 창을 열 수 없어요.",
    "acc.signedIn": "{name}님 반가워요!",
    "acc.signedOut": "로그아웃했어요."
  };

  const EN = {
    "nav.home": "Home", "nav.list": "List", "nav.map": "Map", "nav.tips": "Pet Tips",
    "top.mypet": "My Pet",
    "top.langBtn": "한국어",
    "top.langTitle": "한국어로 보기",
    "top.regionTitle": "Change region",
    "doc.title": "Gachigagae — Pet-Friendly Travel Guide in Korea",

    "demo.text": "<b>Demo mode</b> — showing sample places until the public data feed is connected.",

    "hero.eyebrowA": "",
    "hero.eyebrowB": " places from public data · rules checked for you",
    "hero.title": "A happy day out <br> with your <br> best friend",
    "hero.lead": "Go anywhere together — we gather only the places that welcome pets.",
    "hero.ph": "e.g. Indoor cafés in Seoul that allow small dogs",
    "hero.search": "Search",
    "ex.1": "Jeju spots for big dogs",
    "ex.2": "Indoor dining in Seoul",
    "ex.3": "Pet-friendly stays in Gyeonggi",
    "ex.4": "Shih Tzu travel tips",
    "ex.reset": "Reset",
    "ex.resetTitle": "Clear every filter and start over",
    "guide.hello": "Hi! I'm <b>Gagae</b>, your travel buddy.<br>Tell me where you want to go and I'll find the right place!",

    "region.eyebrow": "REGION",
    "region.title": "Start with a region",
    "region.sub": "Your pick applies to the list, the map and the hot spots below — all at once",
    "region.now": "Now browsing",
    "region.pick": "Choose region",
    "region.done": "Switched to {area}! 🐾 The list and the hot spots below moved with you.",

    "panel.mypet": "MY PET",
    "panel.mypetTitle": "What I know about your pet",
    "panel.editInfo": "Edit my info",
    "panel.today": "TODAY",
    "panel.todayTitle": "Today's pet tip",
    "panel.nextTip": "Another tip",
    "panel.quiz": "Take the quiz",

    "pf.title": "Tell me about your pet",
    "pf.cardTitle": "My pet",
    "pf.sub": "We check each place's rules against your pet so you never make a wasted trip",
    "pf.stateEmpty": "Not set yet",
    "pf.breedLabel": "Fill in automatically from a breed",
    "pf.aiChip": "AI CLASSIFIER",
    "pf.breedPh": "e.g. Shih Tzu, Golden Retriever, Korean Shorthair",
    "pf.breedBtn": "Identify breed",
    "pf.name": "Name", "pf.namePh": "e.g. Kongi",
    "pf.species": "Species", "pf.dog": "Dog", "pf.cat": "Cat", "pf.other": "Other",
    "pf.weight": "Weight (kg)",
    "pf.size": "Size class",
    "pf.sizeAuto": "Decide from weight",
    "pf.small": "Small (under 10kg)",
    "pf.medium": "Medium (10 – 25kg)",
    "pf.large": "Large (25kg and up)",
    "pf.gear": "Gear you can bring",
    "pf.leash": "Leash (2m or shorter)",
    "pf.cage": "Carrier / crate / stroller",
    "pf.muzzle": "Muzzle",
    "pf.vaccine": "Vaccinations up to date",
    "pf.save": "Save and check places for my pet",

    "cat.eyebrow": "CATEGORY",
    "cat.title": "Browse by category",
    "cat.subA": "",
    "cat.subB": " places nationwide",
    "cat.count": "{n} places",
    "cat.able": "{n} allowed",

    "band.eyebrow": "QUIZ · 105 QUESTIONS",
    "band.title": "The more you know,<br>the safer they are",
    "band.text": "Hygiene, vaccines, dangerous foods — ten true/false questions to keep your pet safe.",
    "band.cta": "Try the quiz",

    "src.eyebrow": "SOURCE",
    "src.title": "Public data we use",
    "src.1n": "9,764", "src.1b": "Korea Tourism Organization", "src.1s": "Pet-friendly travel service",
    "src.2n": "70,650", "src.2b": "Korea Culture Information Service", "src.2s": "Pet-friendly facilities",
    "src.3n": "5,038", "src.3b": "Ministry of the Interior and Safety", "src.3s": "Animal hospitals · 406 bad records removed after a full audit",
    "src.foot": "Gachigagae · Entry for the 2026 Tourism Data Contest",

    "hot.eyebrow": "HOT NOW",
    "hot.title": "hot spots",
    "hot.pattern": "Hot {cat} in {area}",
    "hot.sub": "Ranked by Naver visitor ratings · change the region or category any time",
    "hot.loading": "Looking for the highest-rated places…",
    "hot.none": "No ratings found for this combination. Try another region or category.",
    "hot.noRate": "No rating yet",
    "hot.review": "{n} reviews",
    "hot.open": "See details",
    "hot.refresh": "Search again",
    "hot.hint": "Tap a card to see the rules and the checklist",

    "res.title": "List",
    "res.searchPh": "Search name or address",
    "res.fitOnly": "Allowed only",
    "res.reSearch": "Ask AI again",
    "res.reSearchTitle": "Ask the AI assistant again",
    "res.reset": "Reset",
    "res.resetTitle": "Clear the search and filters",
    "res.toMap": "View on map",
    "res.areaTitle": "Choose region",
    "res.loading": "Loading data…",
    "res.empty": "No place matches these conditions.<br>Try another region or filter.",
    "res.more": "Load more ({a} / {b})",
    "res.registered": "<b>{n}</b> registered",
    "res.loadingMore": " · loading {n}…",
    "res.filtered": " · {n} after filters",
    "res.okCount": "{n} allowed",
    "res.noCount": "{n} not allowed",

    "map.ok": "Allowed", "map.cond": "Conditional", "map.no": "Not allowed", "map.unknown": "Check needed",
    "map.title": "Map", "map.toList": "Back to list", "map.src": "Map: ",

    "tips.eyebrow": "QUIZ & TIPS",
    "tips.title": "Pet knowledge quiz",
    "tips.leadA": "Dogs, cats, vaccines, dangerous foods, basics and body language —",
    "tips.leadB": " answered true or false.",
    "tips.listTitle": "Good to know",
    "tips.listSub": "Hygiene · cleanliness · safety · myths",
    "tips.note": "Health and vaccination notes are general guidance — ask your vet about what fits your pet. Quiz questions and tips are provided in Korean by the source data.",
    "tips.total": "{n} questions in total",
    "tips.koOnly": "",

    "ai.bubble": "Ask me where you want to go — I'll pick only the places your pet can enter.",
    "ai.ph2": "Ask again — type a new question",
    "ai.send": "Send",
    "ai.reset": "Start a new search",
    "ai.foot": "Search conditions are interpreted by Google Gemini",
    "ai.close": "Close",
    "ai.dragClose": "Drag down to close",

    "area.": "All Korea",
    "area.1": "Seoul", "area.2": "Incheon", "area.3": "Daejeon", "area.4": "Daegu", "area.5": "Gwangju",
    "area.6": "Busan", "area.7": "Ulsan", "area.8": "Sejong", "area.31": "Gyeonggi", "area.32": "Gangwon",
    "area.33": "Chungbuk", "area.34": "Chungnam", "area.35": "Gyeongbuk", "area.36": "Gyeongnam",
    "area.37": "Jeonbuk", "area.38": "Jeonnam", "area.39": "Jeju",
    "area.long.33": "Chungcheongbuk-do", "area.long.34": "Chungcheongnam-do", "area.long.35": "Gyeongsangbuk-do",
    "area.long.36": "Gyeongsangnam-do", "area.long.37": "Jeollabuk-do", "area.long.38": "Jeollanam-do",

    "type.39": "Restaurants & cafés", "type.12": "Attractions", "type.38": "Shopping", "type.32": "Stays",
    "type.28": "Sports & play", "type.14": "Culture & public",
    "type.culture:medical": "Clinics & pharmacies", "type.culture:service": "Pet services",
    "type.culture:trip": "Travel spots", "type.culture:cafe": "Pet cafés & dining",
    "type.none": "No category selected",

    "st.ok": "Allowed", "st.cond": "Conditional", "st.no": "Not allowed", "st.unknown": "Rules unclear",
    "size.small": "small", "size.medium": "medium", "size.large": "large",
    "size.small.range": "under 10kg", "size.medium.range": "10 – 25kg", "size.large.range": "25kg and up",
    "unit.dog": " dog",

    "rb.none": "No rule info",
    "rb.weight": "{n}kg or less",
    "rb.sizes": "{s} only",
    "rb.leash": "Leash required",
    "rb.cage": "Carrier / stroller",
    "rb.muzzle": "Muzzle",
    "rb.outdoor": "Outdoor only",
    "rb.vaccine": "Proof of vaccination",
    "rb.official": "Official data",
    "rb.verified": "Rules verified",
    "rb.sample": "Sample (unverified)",

    "jd.unknown": "No pet rules are registered for this place. Please call ahead before visiting.",
    "jd.guideOnly": "Only assistance dogs (guide dogs) are welcome here. Ordinary pets cannot enter.",
    "jd.banned": "This place is listed as not allowing pets.",
    "jd.weightRule": "Weight limit: {n}kg or less",
    "jd.sizeRule": "Size limit: {s} only",
    "jd.indoorLimit": "Indoors restricted — pets are welcome in outdoor areas only",
    "jd.setProfile": "🐶 Add your pet's details and I'll judge every place against them.",
    "jd.overWeight": "Over the weight limit: this place allows {limit}kg or less (your pet is {mine}kg)",
    "jd.overSize": "Size limit: {s} only (your pet is {mine})",
    "jd.needLeash": "A leash is required — you haven't checked it in your gear list.",
    "jd.needCage": "A carrier, crate or stroller is required — not checked in your gear list.",
    "jd.needMuzzle": "A muzzle is required — not checked in your gear list.",
    "jd.needVaccine": "Proof of vaccination is required — please confirm your pet's shots.",
    "jd.outdoorOnly": "Indoors restricted — pets are welcome on the terrace and other outdoor areas only.",
    "jd.dangerBreed": "The five legally designated dangerous breeds are restricted or must wear a muzzle.",
    "jd.allGood": "Based on your pet's profile, the rules say you're good to go. 🎉",

    "ck.callFirst": "Call ahead to confirm pets are welcome",
    "ck.leash": "Leash",
    "ck.leash2": "Leash (2m or shorter recommended)",
    "ck.poop": "Waste bags",
    "ck.cage": "Carrier, crate or stroller",
    "ck.muzzle": "Muzzle",
    "ck.vaccine": "Vaccination certificate (pet registration card)",
    "ck.weight": "Check the weight ({n}kg or less)",
    "ck.outdoor": "Outdoor seating — plan for rain",

    "rc.animals": "Pets allowed", "rc.type": "Entry type", "rc.need": "What you must bring",
    "rc.etc": "Other notes", "rc.fclty": "Facilities", "rc.frnsh": "Items on site",
    "rc.rental": "Available to rent", "rc.purchase": "Available to buy", "rc.risk": "Safety notes",
    "rc.yes": "Pets allowed", "rc.no": "Pets not allowed",

    "dt.loading": "Loading…",
    "dt.gmap": "Directions on Google Maps", "dt.kakao": "KakaoMap",
    "dt.routeKakao": "Directions (KakaoMap)",
    "dt.gmapView": "View on Google Maps",
    "dt.geoSuspect": "The published coordinates disagree with the address, so directions search by name and address instead.",
    "dt.rating": "Checking ratings and reviews…",
    "dt.noRating": "No Naver rating or review found. Calling ahead is recommended.",
    "dt.visitorReview": "{n} visitor reviews",
    "dt.blog": "{n} blog posts",
    "dt.moreNaver": "Read more reviews on Naver Place",
    "dt.rules": "Pet rules (original text)",
    "dt.noRules": "No rules are registered for this place. {tel}",
    "dt.callTel": "Please confirm at {tel}.",
    "dt.checkBefore": "Please confirm before visiting.",
    "dt.source": "Source: ",
    "dt.callWarn": " — <b>call ahead before visiting</b>",
    "dt.checklist": "Before you go — checklist",
    "dt.nearby": "Pet-friendly attractions nearby",
    "dt.nearbyNear": "nearest first",
    "dt.nearbyRadius": "within {n}km",
    "dt.nearbyNone": "No pet-friendly attraction is registered within this radius.",
    "dt.nearbyRule": "See details for the rules",
    "dt.vets": "Animal hospitals nearby",
    "dt.vetsSub": "just in case while travelling",
    "dt.vetsLoading": "Loading animal hospitals…",
    "dt.vetsNone": "No animal hospital is registered in this area.",
    "dt.vetsFallback": "The public dataset isn't connected yet, so we'll search the map instead.",
    "dt.vetsSearch": "Find animal hospitals in {area}on the map",
    "dt.vetQuery": "{area} 동물병원",
    "dt.facility": "Facility info",
    "dt.detail": "Details", "dt.route": "Directions", "dt.detailRule": "Details & rules",
    "dt.close": "Close",
    "dt.noAddr": "No address on record",
    "dt.allDog": "all breeds",
    "dt.outdoorShort": "outdoor only",
    "dt.leashShort": "leash",

    "fi.hours": "Opening hours", "fi.holiday": "Closed on", "fi.parking": "Parking",
    "fi.fee": "Admission", "fi.petFee": "Extra fee for pets", "fi.space": "Space",
    "fi.yes": "Available", "fi.no": "Not available",
    "fi.indoor": "Indoor", "fi.outdoor": "Outdoor", "fi.both": "Indoor & outdoor",

    "ms.head": "🐾 Of <b>{n} {cat}</b> in {area},",
    "ms.cultureProfile": "{head} <b>{able}</b> welcome your pet! ({no} don't)",
    "ms.cultureNoProfile": "{head} <b>{able}</b> allow pets. Add your pet's profile and I'll narrow it down further!",
    "ms.tour": "{head} <b>{able}</b> are registered as pet-friendly. Tap one to see the fine print!",
    "ms.reset": "Search cleared! 🐾 Ask me again or pick a category below.",
    "ms.saved": "✅ Saved <b>{name}</b> ({kg}kg · {size}{unit} · {range})!<br>From now on I'll only show places that fit 🐾",

    "ex.noData": "<b>Pet facility data not connected</b>",
    "ex.how": "<b>How to connect</b>",
    "ex.step1": "Apply on data.go.kr",
    "ex.step1s": " (free, instant)",
    "ex.step2": "② After approval, refresh and <b>70,650 places</b> appear automatically",
    "ex.step3": "※ The existing key is reused — no new key needed",

    "in.pet": "Your pet", "in.gear": "Gear", "in.none": "None",
    "in.empty": "No pet details yet.<br><span>Add them and every place gets judged <b>against your pet</b>.</span>",
    "in.watching": "Now browsing",
    "in.stat": "places allow pets<br><small>of {loaded} loaded{no}</small>",
    "in.statNo": " · {n} not allowed",
    "in.hint": "Pick a category and I'll count how many places your pet can enter.",
    "in.quiz": "Quiz score",
    "in.quizScore": "{right} / {done} correct",
    "in.quizNone": "Not started yet",

    "qz.all": "All", "qz.random": "Random {n}",
    "qz.noQuestion": "Couldn't load the questions.",
    "qz.doneT": "{cat} quiz complete!",
    "qz.randomCat": "Random",
    "qz.doneS": "{right} / {total} correct",
    "qz.doneN": "{round} of {all} questions are drawn at random. Play again for a different set.",
    "qz.w100": "A perfect score. You're a certified pet parent!",
    "qz.w70": "You know your stuff! Re-read the ones you missed and you're set.",
    "qz.w0": "Read the explanations slowly — fewer wasted trips and fewer accidents.",
    "qz.restart": "Play again",
    "qz.yes": "True", "qz.no": "False",
    "qz.right": "Correct!", "qz.wrong": "Not quite",
    "qz.answer": "Answer: {a}",
    "qz.ansO": "O True", "qz.ansX": "X False",
    "qz.next": "Next question", "qz.result": "See result",
    "qz.first": "Answer your first question",
    "qz.confirm": "Erase your record of <b>{n} questions</b>?",
    "qz.confirmYes": "Erase", "qz.confirmNo": "Cancel",
    "qz.cum": "Lifetime score · {pct}%",
    "qz.share": "Share my result", "qz.resetScore": "Clear record",
    "qz.sharePanel": "Share your lifetime record",
    "qz.shareTitle": "Share my result",

    "sh.copyFb": "The text is on your clipboard — paste it into the Facebook composer.",
    "sh.copyFbManual": "Copy the text below and paste it into the Facebook composer.",
    "sh.copied": "Result text and link copied. Paste it anywhere you like.",
    "sh.copyManual": "Automatic copying is blocked. Please copy the text below.",
    "sh.making": "Building your result card…",
    "sh.igOk": "Result card saved. Post it on Instagram and paste <b>the copied caption</b>!",
    "sh.igManual": "Result card saved. Copy the caption below to post with it.",
    "sh.igFail": "Couldn't build the image. Please take a screenshot instead.",
    "sh.grade100": "Perfect Pet Parent", "sh.grade80": "Veteran Pet Parent",
    "sh.grade60": "Growing Pet Parent", "sh.grade0": "Still Learning",
    "sh.tipLabel": "Pet knowledge",
    "sh.cumTitle": "Lifetime quiz record",
    "sh.roundTitle": "{label} quiz result",
    "sh.textCum": "I've answered {total} Gachigagae {label} questions with {right} correct! ({pct}%) — {grade} 🐾",
    "sh.textRound": "I got {right} of {total} on the Gachigagae {label} quiz! ({pct}%) — {grade} 🐾",
    "sh.textFoot": "Find places you can visit with your pet, too.",
    "sh.copyBtn": "Copy text",
    "img.brand": "Gachigagae",
    "img.sub": "Pet-friendly travel guide",
    "img.rate": "{pct}% correct",
    "img.foot": "Check where your pet can go — and the rules — before you leave",

    "aj.thinking": "<b>{q}</b><br>Thinking about where to look…",
    "aj.searching": "Searching the public data…",
    "aj.choosing": "Picking the best of {n} places…",
    "aj.willFind": "Let me look!",
    "aj.fail": "Couldn't load the data: ",
    "aj.notFound": "<br>I couldn't find a match… try another region or condition? 🥲",
    "aj.whyOk": "The rules let you walk right in.",
    "aj.whyCond": "Meet one condition and you're both welcome.",
    "aj.whyUnknown": "Registered as pet-friendly — check the details for the fine print.",
    "aj.liveLoad": "Checking ratings and reviews…",
    "aj.liveNone": "Not listed on Naver — calling ahead is recommended",
    "aj.allList": "Full list", "aj.onMap": "Show on map", "aj.again": "Search again",
    "aj.askAgain": "Want me to find somewhere else? Ask below! 🐾",
    "aj.analyzing": "Analysing <b>{b}</b>…",
    "aj.stdTable": "Standard breed table",
    "aj.gemini": "Gemini AI",
    "aj.breedReply": "The {name} is a {size}{unit}{range}! I'll pick places that fit 🐾",
    "aj.dangerous": "Legally dangerous breed", "aj.needMuzzle": "Muzzle required",
    "aj.noKey": "The AI assistant isn't connected yet.<br><span style=\"color:var(--ink-sub);font-size:12px;\">Set the Netlify environment variable <b>GEMINI_API_KEY</b> and redeploy to enable it.</span>",
    "aj.err": "No answer came back from the AI 🥲<br>",
    "aj.sizeSmall": "small dog", "aj.sizeMedium": "medium dog", "aj.sizeLarge": "large dog",
    "aj.indoor": "indoor",
    "aj.nameExample": "e.g. my {name}",
    "aj.searchResult": "AI search results",

    /* ── Floating buddy ── */
    "bd.hello": "Hi! I'm <b>Gagae</b>, your travel buddy. I'll follow along and help out 🐾",
    "bd.offHint": "Finding this distracting? Tap <b>Hide buddy</b> below. You can also mute just the sound, and turn either back on any time.",
    "bd.searching": "Running off to find <b>the right spot</b>… woof woof!",
    "bd.found": "Found them! Start with the picks I recommended 🐾",
    "bd.back": "I'm back! I'll keep helping from here 🐾",
    "bd.dogTitle": "Tap Gagae for the next tip",
    "bd.ask": "Go to that screen?",
    "bd.goYes": "Take me there",
    "bd.goNo": "No thanks",
    "bd.off": "Hide buddy",
    "bd.offTitle": "Hides the buddy — you can bring it back any time with the button at the bottom right",
    "bd.on": "Show buddy",
    "bd.onTitle": "Bring the Gagae buddy back",
    "bd.tip1": "🐶 Save <b>your pet's details</b> and I'll judge every place for you!",
    "bd.tip2": "🎒 Bring what's on the <b>checklist</b> in the detail view and you won't be turned away.",
    "bd.tip3": "📞 For places badged <b>Check first</b>, calling ahead is the safe move.",
    "bd.tip4": "🗺️ Tap <b>Directions</b> in the detail view to jump straight into KakaoMap.",
    "bd.tip5": "📍 Change the <b>region button</b> up top and the list, map and hot places all follow.",
    "bd.tip6": "🔎 Ask in <b>plain words</b> — e.g. indoor cafes in Seoul for a small dog!",
    "bd.page.home": "🏠 Home! Ask in the search box and I'll find the right place.",
    "bd.page.results": "📋 The list. Tick <b>Allowed only</b> to keep just the sure things!",
    "bd.page.map": "🗺️ The map! Pin colours show entry status at a glance.",
    "bd.page.tips": "🐾 Check your pet knowledge with the quiz!",


    "wc.title": "Gachigagae",
    "wc.lead": "Sign in to keep the places you like in your favourites.",
    "wc.skip": "Continue without signing in",
    "wc.note": "Search, map and quiz work fully without an account.",
    "sh.share": "Share",
    "sh.kakao": "KakaoTalk",
    "sh.insta": "Instagram",
    "sh.x": "X",
    "sh.via": "— found on Gachigagae",
    "sh.appText": "Find places you can visit with your pet on Gachigagae!",
    "sh.instaCopied": "Text copied. Paste it into Instagram!",
    "sh.kakaoBtn": "Open in Gachigagae",
    "sh.kakaoFallback": "Couldn't open KakaoTalk sharing. The text is copied — just paste it.",
    "sh.copied": "Text copied.",
    "sh.copyFail": "Could not copy. Please long-press to copy manually.",
    "fav.title": "Favourites",
    "fav.btnTitle": "See your saved places",
    "fav.add": "Save to favourites",
    "fav.remove": "Remove from favourites",
    "fav.added": "Saved to favourites",
    "fav.removed": "Removed from favourites",
    "fav.empty": "Nothing saved yet.<br>Tap the <b>heart</b> on any place card and it lands here.",
    "fav.count": "{n} saved",
    "fav.open": "Details",
    "fav.route": "Directions",
    "fav.clear": "Clear all",
    "fav.clearAsk": "Remove every saved favourite?",
    "fav.guestNote": "Sign in with Google to use favourites.",
    "fav.needLogin": "Sign in with Google to use favourites.",
    "fav.openList": "Open as list",
    "fav.backToAll": "Back to all places",
    "fav.loginEmpty": "Sign in with Google to save the places you like.<br>Saved places stay with this account only.",
    "fav.userNote": "Saving to {name}'s account",

    "acc.signIn": "Sign in with Google",
    "acc.signInTitle": "Sign in to use favourites (search, map and quiz work without it)",
    "acc.signOut": "Sign out",
    "acc.guest": "Guest",
    "acc.optional": "Only favourites need a sign-in. Search, map and quiz work without it.",
    "acc.failed": "Could not finish signing in. Please try again in a moment.",
    "acc.noNet": "Check your internet connection and try again.",
    "acc.blocked": "The Google sign-in window can't be opened right now.",
    "acc.signedIn": "Welcome, {name}!",
    "acc.signedOut": "Signed out."
  };

  const DICT = { ko: KO, en: EN };
  const KEY = "petmap_lang";

  function detect() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "ko" || saved === "en") return saved;
    } catch (_) {}
    // 브라우저가 한국어가 아니면 영어로 맞이한다(공모전 심사·해외 방문객 대응)
    const nav = (navigator.language || "ko").toLowerCase();
    return nav.indexOf("ko") === 0 ? "ko" : "en";
  }

  let lang = detect();

  /** 번역 조회 — 키가 없으면 한국어 → 키 순으로 폴백한다 */
  function t(key, vars) {
    let s = DICT[lang][key];
    if (s === undefined) s = KO[key];
    if (s === undefined) return key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, (m, k) =>
        (vars[k] === undefined || vars[k] === null) ? "" : String(vars[k]));
    }
    return s;
  }

  /** 정적 마크업 채우기 */
  function apply(root) {
    const r = root || document;
    r.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    r.querySelectorAll("[data-i18n-html]").forEach(el => {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    r.querySelectorAll("[data-i18n-ph]").forEach(el => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
    });
    r.querySelectorAll("[data-i18n-title]").forEach(el => {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    r.querySelectorAll("[data-i18n-aria]").forEach(el => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
    if (r === document) {
      document.documentElement.lang = lang;
      document.title = t("doc.title");
    }
  }

  function setLang(next) {
    if (next !== "ko" && next !== "en") return;
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem(KEY, lang); } catch (_) {}
    apply(document);
    // 아이콘은 innerHTML 교체로 지워질 수 있어 다시 채운다
    if (window.Icon && window.Icon.hydrate) window.Icon.hydrate();
    document.dispatchEvent(new CustomEvent("petmap:lang", { detail: { lang } }));
  }

  window.T = t;
  window.I18N = {
    t, apply, setLang,
    get lang() { return lang; },
    isEn() { return lang === "en"; },
    toggle() { setLang(lang === "ko" ? "en" : "ko"); }
  };
})();
