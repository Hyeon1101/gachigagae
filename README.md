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
         → apis.data.go.kr/B551011/KorPetTourService2 (한국관광공사 반려동물 동반여행 서비스)
         → 실패/키 미설정 시 data/sample.json 데모 데이터 폴백 (배너 표시)
```
오퍼레이션명 접미사(`areaBasedList2` …)는 Function이 자동 폴백하며,
`/apitest.html` 에서 어떤 조합이 유효한지 원클릭 진단 가능.
모든 데이터 함수는 상류 호출에 시한·1회 재시도가 있고, **실패 응답은 캐시하지 않는다**(성공만 CDN 24시간).

## AI 도우미 (Google Gemini)
- `/api/ai` (Netlify Function) — `search`(질문→검색 조건) · `breed`(품종→크기) · `advise`(후보 중 추천 3곳)
- 모델 체인(2026-10): 검색·품종 = `gemini-3.5-flash-lite → 3.1-flash-lite → 3.5-flash → 2.5-flash → 2.5-flash-lite`,
  추천 = `gemini-3.8-flash → 3.5-flash → 3.5-flash-lite → 2.5-flash`. 503·404·응답 잘림은 다음 모델로,
  **월 지출 한도 초과·키 거절은 즉시 중단**(같은 키로는 어느 모델도 안 됨). 환경변수 `GEMINI_FAST_MODELS` / `GEMINI_SMART_MODELS` 로 순서 변경 가능.
- 추론(thinking)은 끈다. `3.5-flash-lite` 는 `thinkingBudget: 0` 을 400 으로 거절해 `thinkingLevel: "minimal"` 로 보낸다.
  처음 보는 모델이 400 을 주면 함수가 `thinkingBudget 0 → thinkingLevel minimal → 설정 없음` 순서로 다시 부른다.
- 실측(2026-10-13, 배포 서버): 검색 0.6~1.0초 · 품종 1.1초(3.5-flash-lite), 추천 1.7~3초(3.8-flash).
  한 모델이 검색·품종 5초, 추천 8초를 넘기면 다음 모델로 넘어간다. 체인 전체는 10초·13초 안에 끝나서 화면 대기 한도(12초·15초)보다 먼저 답한다.
- AI 가 실패해도 검색은 멈추지 않는다 — 화면이 질문 속 낱말(지역·종류·크기·실내)로 조건을 만들어 이어 간다.
- 키 넣기/바꾸기: `powershell -ExecutionPolicy Bypass -File dev\set_gemini_key.ps1` (키는 Netlify 비밀값으로만 저장, 저장 후 자동 재배포)
- 상태 점검: `/apitest.html` → 「AI 도우미 점검」

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
cd "Downloads/유니월드/petmap 수정본"
netlify deploy --prod --site 33f0380a-7e91-4a4e-99e6-ffaa91c5a37f   # ggagae.com
```
배포 폴더가 저장소 루트라서 `/netlify/*`, `/dev/*`, `/docs/*`, `/README.md` 는 `netlify.toml` 에서 404 로 막아 둔다.

## 데모 데이터 안내
`data/sample.json` 은 UI 시연용입니다.
- 공원(관광지)은 공개된 이용수칙 기반(목줄·배변봉투 등), `verified: true`
- `(샘플)` 표기 식당·숙박은 가상의 장소 — TourAPI 키 연결 시 실데이터로 자동 대체
- 스타벅스 더북한강R점은 언론 보도 기반 실제 반려견 동반 매장 (방문 전 재확인 권장)

## 확장 계획 (APK)
Capacitor 로 래핑해 Android APK 생성 예정 (krahk-app 프로젝트와 동일 파이프라인).
