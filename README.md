# 🐾 같이가개 — 반려동물 동반 여행 가이드

**2026 관광데이터 활용 공모전 (웹·앱 구현 부문) — 지정과제 6번**
"모호한 반려동물 출입 조건 및 규정 인지 오류로 현장 입장 거부 및 헛걸음 유발 문제"

해시태그: `#반려동물여행` `#헛걸음방지` `#조건해석` `#여행가이드`

## 핵심 기능
| 기능 | 설명 |
|---|---|
| 🐶 반려동물 프로필 | 종류·몸무게·크기·준비물(목줄/케이지/입마개/접종) 설정 |
| ✅ 입장 판정 엔진 | 장소별 규정 텍스트를 해석해 **입장 가능/조건부/불가** 자동 판정 (`js/rules.js`) |
| 📋 규정 카드 | TourAPI 원문 규정(동반 가능 동물, 필수 준비사항, 기타 정보 등) 구조화 표시 |
| 🎒 체크리스트 | 규정 기반 방문 전 준비물 자동 생성 → 헛걸음 방지 |
| 🏞️ 관광지 연계 | 선택한 식당 반경 3km 내 반려동물 동반 가능 관광지 추천 |
| 🗺️ 길안내 | 카카오맵 길찾기 딥링크(무키), 식당→관광지 경로 안내 |
| 🔎 필터 | 지역(시도)·유형(식당/관광지/숙박)·검색·"입장 가능만 보기" |

## 데이터 흐름
```
브라우저 → /api/pettour (Netlify Function, 키 보호)
         → apis.data.go.kr/B551011/KorPetTourService1 (한국관광공사 반려동물 동반여행 서비스)
         → 실패/키 미설정 시 data/sample.json 데모 데이터 폴백 (배너 표시)
```
오퍼레이션명 접미사(`areaBasedList` / `areaBasedList1` …)는 Function이 자동 폴백하며,
`/apitest.html` 에서 어떤 조합이 유효한지 원클릭 진단 가능.

## 필요한 API 키 (등록 절차)
1. **[필수] TourAPI 반려동물 동반여행 서비스** — 공모전 필수 정부 OpenAPI
   - https://www.data.go.kr/data/15135102/openapi.do → 활용신청(즉시 승인, 무료)
   - 발급된 **일반 인증키(Decoding)** 를 → `netlify env:set TOURAPI_KEY "키"` → 재배포
2. **[권장] 카카오맵 JavaScript 키** — 실제 대한민국 지도
   - https://developers.kakao.com → 앱 생성 → JavaScript 키 복사
   - 플랫폼 > Web 도메인 등록: `http://localhost:8899`, 배포 도메인(`https://….netlify.app`)
   - `js/config.js` 의 `KAKAO_JS_KEY` 에 입력 (미입력 시 OpenStreetMap 폴백)
3. **[선택] 카카오모빌리티 길찾기 REST 키** — 지도 위 경로선 그리기 고도화용 (현재는 카카오맵 딥링크로 무키 길안내 동작)

## 로컬 실행
```bash
# 정적 미리보기 (데모 데이터 모드)
python -m http.server 8899 --directory Downloads/petmap

# Function 포함 실행 (실데이터 테스트)
cd Downloads/petmap && netlify dev
```

## 배포
```bash
cd Downloads/petmap
netlify deploy --prod
```

## 데모 데이터 안내
`data/sample.json` 은 UI 시연용입니다.
- 공원(관광지)은 공개된 이용수칙 기반(목줄·배변봉투 등), `verified: true`
- `(샘플)` 표기 식당·숙박은 가상의 장소 — TourAPI 키 연결 시 실데이터로 자동 대체
- 스타벅스 더북한강R점은 언론 보도 기반 실제 반려견 동반 매장 (방문 전 재확인 권장)

## 확장 계획 (APK)
Capacitor 로 래핑해 Android APK 생성 예정 (krahk-app 프로젝트와 동일 파이프라인).
