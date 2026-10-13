/* ─────────────────────────────────────────────────────────────
 * apitest.html 전용 스크립트 (팀원용 QA 도구)
 *
 * 예전에는 이 코드가 apitest.html 안에 <script> 로 박혀 있었다.
 * 인라인 스크립트가 한 곳이라도 남아 있으면 사이트 전체 CSP 에
 * script-src 'unsafe-inline' 을 열어 줘야 해서 밖으로 뺐다.
 *
 * 화면에 찍는 글은 전부 상류(공공데이터포털·odcloud)가 준 것이므로
 * 반드시 esc() 를 거친다 — 진단 도구라고 예외를 두지 않는다.
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var out = document.getElementById("out");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  /** 활용신청 링크 — http(s) 주소만 통과시킨다 */
  function safeUrl(u) {
    var s = String(u == null ? "" : u).trim();
    return /^https?:\/\//i.test(s) ? esc(s) : "";
  }
  function pre(text) { out.innerHTML = "<pre>" + esc(text) + "</pre>"; }

  document.getElementById("run").addEventListener("click", async function () {
    out.innerHTML = "<p>진단 중…</p>";
    try {
      const res = await fetch("/api/pettour?op=areaBasedList&areaCode=1&numOfRows=1&probe=1");
      const json = await res.json();
      if (json.error) { pre(JSON.stringify(json, null, 2)); return; }
      out.innerHTML = "<table><tr><th>엔드포인트</th><th>결과</th><th>사유</th></tr>" +
        json.probe.map(r =>
          `<tr><td>${esc(r.endpoint)}</td><td class="${r.ok ? "ok" : "fail"}">${r.ok ? "OK ✅" : "실패"}</td><td>${esc(r.why)}</td></tr>`
        ).join("") +
        "</table>";
    } catch (e) {
      pre("요청 실패: " + e.message +
        "\n(로컬 정적 서버에서는 Function이 없습니다. netlify dev 또는 배포 환경에서 실행하세요.)");
    }
  });

  document.getElementById("extraCall").addEventListener("click", async function () {
    out.innerHTML = "<p>점검 중…</p>";
    const srcs = [
      ["culture", "한국문화정보원 반려동물 동반 가능 문화시설 (70,650건)"],
      ["vet", "행정안전부 동물병원 (9,445건)"]
    ];
    const rows = [];
    for (const [src, label] of srcs) {
      try {
        const res = await fetch(`/api/extra?src=${encodeURIComponent(src)}&page=1&perPage=1`);
        const j = await res.json();
        if (j.error) {
          const link = safeUrl(j.applyUrl);
          rows.push(`<tr><td>${esc(label)}</td><td class="fail">미연결</td><td>${esc(j.hint || j.message)}<br>
            ${link ? `<a href="${link}" target="_blank" rel="noopener">→ 활용신청 바로가기</a>` : ""}</td></tr>`);
        } else {
          const cols = j.data && j.data[0] ? Object.keys(j.data[0]).join(", ") : "-";
          rows.push(`<tr><td>${esc(label)}</td><td class="ok">연결됨 ✅</td><td>총 ${(j.totalCount || 0).toLocaleString()}건<br>
            <span style="font-size:11px;color:#667085;">컬럼: ${esc(cols)}</span></td></tr>`);
        }
      } catch (e) {
        rows.push(`<tr><td>${esc(label)}</td><td class="fail">오류</td><td>${esc(e.message)}</td></tr>`);
      }
    }
    out.innerHTML = `<table><tr><th>데이터</th><th>상태</th><th>상세</th></tr>${rows.join("")}</table>`;
  });

  /* AI 는 조용히 죽는다 — 2026-10-13 에 구글 프로젝트 월 지출 한도 초과로 모든 AI 답이
   * 실패하고 있었는데 화면만 봐서는 알 수 없었다. 여기서 한 번 불러 어느 모델이 몇 초에 답했는지,
   * 실패면 왜 실패했는지(한도·키·과부하)를 사람 말로 보여 준다. */
  var AI_REASON = {
    spending_cap: "구글 프로젝트의 월 지출 한도 초과 → https://aistudio.google.com/spend 에서 한도를 올리거나, 다른 프로젝트에서 만든 키로 바꾸세요 (같은 프로젝트의 새 키는 소용없음).",
    billing: "구글 결제 설정 문제 → AI Studio 의 결제(Billing) 화면을 확인하세요.",
    invalid_key: "키가 거절됨 → dev\\set_gemini_key.ps1 로 올바른 키를 다시 넣으세요.",
    location: "지역 제한으로 거절됨.",
    unavailable: "모든 모델이 과부하·시간 초과 → 잠시 뒤 다시 점검하세요.",
    rate_limited: "호출이 너무 잦음 → 1분 뒤 다시 점검하세요."
  };
  document.getElementById("aiCall").addEventListener("click", async function () {
    out.innerHTML = "<p>AI 점검 중… (최대 20초)</p>";
    const t0 = Date.now();
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "search", q: "서울에서 소형견이랑 갈 만한 실내 카페", lang: "ko" })
      });
      const j = await res.json().catch(() => ({}));
      const wall = ((Date.now() - t0) / 1000).toFixed(1) + "초";
      if (j.ok) {
        out.innerHTML = `<table><tr><th>상태</th><th>모델</th><th>시간</th><th>해석 결과</th></tr>
          <tr><td class="ok">정상 ✅</td><td>${esc(j.model)}</td><td>${esc(wall)} (서버 ${esc(j.ms)}ms)</td>
          <td>${esc(JSON.stringify(j.data))}</td></tr></table>` +
          (j.fallback ? `<pre>앞 모델 실패 기록: ${esc(JSON.stringify(j.fallback))}</pre>` : "");
      } else {
        const why = AI_REASON[j.reason] || (j.error === "NO_KEY" ? "키가 없음 → dev\\set_gemini_key.ps1 로 키를 넣으세요." : (j.message || j.error || ("HTTP " + res.status)));
        out.innerHTML = `<table><tr><th>상태</th><th>이유</th><th>시간</th></tr>
          <tr><td class="fail">실패</td><td>${esc(why)}</td><td>${esc(wall)}</td></tr></table>` +
          `<pre>${esc(JSON.stringify(j, null, 2))}</pre>` +
          "<p>※ AI 가 실패해도 사이트 검색은 질문 속 낱말로 계속 동작합니다(로컬 해석).</p>";
      }
    } catch (e) { pre("요청 실패: " + e.message); }
  });

  document.getElementById("sampleCall").addEventListener("click", async function () {
    out.innerHTML = "<p>조회 중…</p>";
    try {
      const res = await fetch("/api/pettour?op=areaBasedList&areaCode=1&contentTypeId=39&numOfRows=3");
      const json = await res.json();
      pre(JSON.stringify(json, null, 2).slice(0, 4000));
    } catch (e) { pre("요청 실패: " + e.message); }
  });
})();
