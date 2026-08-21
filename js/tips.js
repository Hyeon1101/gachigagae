/* ─────────────────────────────────────────────────────────────
 * 반려동물 상식 · 퀴즈 (data/tips.json)
 *  - 홈 히어로 왼쪽 : 오늘의 상식 카드 (위생·청결·잘못된 상식)
 *  - 홈 히어로 오른쪽: 내 정보 요약 카드
 *  - 「반려동물 팁」 페이지: 카테고리별 O/X 퀴즈 + 상식 목록
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const T = (k, v) => window.T(k, v);
  const SCORE_KEY = "petmap_quiz_score";

  let DATA = null;
  let tipIdx = 0;
  const quiz = {
    cat: "all",
    pool: [],      // 현재 카테고리의 문제 (섞은 순서)
    i: 0,
    answered: false,
    right: 0,
    done: 0
  };

  async function load() {
    if (DATA) return DATA;
    const res = await fetch("data/tips.json");
    DATA = await res.json();
    return DATA;
  }

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function loadScore() {
    try { return JSON.parse(localStorage.getItem(SCORE_KEY)) || { right: 0, done: 0 }; }
    catch (_) { return { right: 0, done: 0 }; }
  }
  function saveScore(s) {
    try { localStorage.setItem(SCORE_KEY, JSON.stringify(s)); } catch (_) {}
  }

  /* ══════════ 퀴즈 밴드 — 오늘의 상식 (한 줄로 순환) ══════════ */

  const TIP_TONE = {
    hygiene: "tone-blue", 청결: "tone-blue",
    health: "tone-green", safety: "tone-red",
    myth: "tone-violet", manner: "tone-amber"
  };

  /** 상식 한 건을 [라벨] 제목 — 본문 한 줄로 그린다.
   *  예전엔 홈 2단 패널(#tipBody)에 3줄 카드로 그렸는데, 패널을 걷어내고
   *  퀴즈 밴드 안으로 옮기면서 한 줄 형태가 됐다. */
  function renderTip() {
    const box = $("#bandTip");
    if (!box || !DATA) return;
    const t = DATA.tips[tipIdx % DATA.tips.length];
    box.innerHTML = `
      <span class="tip-label ${TIP_TONE[t.c] || "tone-blue"}">${esc(t.label)}</span>
      <b class="bt-title">${esc(t.t)}</b>
      <span class="bt-text">${esc(t.b)}</span>`;
    // 교체될 때마다 짧게 페이드 (같은 애니메이션을 다시 태우려면 리플로우가 필요)
    box.style.animation = "none"; void box.offsetWidth; box.style.animation = "";
  }

  function nextTip() { tipIdx++; renderTip(); }

  /* ══════════ 내 정보 요약 ══════════
   * 홈의 「가개가 정리한 내 정보」 패널은 2026-08-13에 걷어냈다(#infoBody 없음).
   * app.js가 프로필 저장·목록 로드 때 계속 호출하므로 함수는 남겨 두고,
   * 자리가 없으면 조용히 빠진다. 요약을 다시 어딘가에 붙이려면 이 함수를 재사용하면 된다. */

  function renderInfo(summary) {
    const box = $("#infoBody");
    if (!box) return;
    const s = summary || (window.PetApp && window.PetApp.summary ? window.PetApp.summary() : null);
    if (!s) return;
    const sc = loadScore();
    const rows = [];

    rows.push(s.profile
      ? `<div class="info-row">
           <span class="ir-k">${T("in.pet")}</span>
           <span class="ir-v"><b>${esc(s.profile.name)}</b> · ${esc(s.profile.sizeLabel)}${T("unit.dog")} ${s.profile.weightKg}kg</span>
         </div>
         <div class="info-row">
           <span class="ir-k">${T("in.gear")}</span>
           <span class="ir-v">${s.profile.gear.length ? s.profile.gear.map(esc).join(" · ") : T("in.none")}</span>
         </div>`
      : `<div class="info-empty">${T("in.empty")}</div>`);

    rows.push(`<div class="info-sep"></div>`);
    rows.push(`<div class="info-row">
        <span class="ir-k">${T("in.watching")}</span>
        <span class="ir-v">${esc(s.areaName)} · ${esc(s.categoryName)}</span>
      </div>`);

    if (s.loaded) {
      rows.push(`<div class="info-stat">
          <span class="is-n">${s.able.toLocaleString()}</span>
          <span class="is-t">${T("in.stat", { loaded: s.loaded.toLocaleString(), no: s.no ? T("in.statNo", { n: s.no.toLocaleString() }) : "" })}</span>
        </div>`);
    } else {
      rows.push(`<div class="info-hint">${T("in.hint")}</div>`);
    }

    rows.push(`<div class="info-sep"></div>`);
    rows.push(`<div class="info-row">
        <span class="ir-k">${T("in.quiz")}</span>
        <span class="ir-v">${sc.done ? T("in.quizScore", { right: sc.right, done: sc.done }) : T("in.quizNone")}</span>
      </div>`);

    box.innerHTML = rows.join("");
  }

  /* ══════════ 퀴즈 페이지 ══════════ */

  function catList() {
    return [{ key: "all", name: T("qz.all"), icon: "🐾" }].concat(DATA.categories);
  }

  function renderCats() {
    const box = $("#quizCats");
    if (!box) return;
    box.innerHTML = catList().map(c => {
      const n = c.key === "all" ? DATA.quiz.length : DATA.quiz.filter(q => q.c === c.key).length;
      return `<button type="button" class="quiz-cat${c.key === quiz.cat ? " on" : ""}" data-cat="${c.key}">
         <span>${c.icon}</span>${esc(c.name)}<em>${c.key === "all" ? T("qz.random", { n: ROUND }) : n}</em>
       </button>`;
    }).join("");
    box.querySelectorAll("[data-cat]").forEach(b =>
      b.addEventListener("click", () => selectCat(b.getAttribute("data-cat"))));
  }

  /** 「전체」는 문항이 100개가 넘어 한 번에 다 풀기엔 길다
   *  → 매번 무작위 ROUND개를 뽑아 라운드로 구성한다(다시 풀 때마다 조합이 달라진다).
   *  20문항은 끝까지 푸는 사람이 적어 완료 화면(=공유)에 도달을 못 했다 → 10문항으로 단축. */
  const ROUND = 10;

  function selectCat(key) {
    quiz.cat = key;
    const all = DATA.quiz.filter(q => key === "all" || q.c === key);
    quiz.pool = key === "all" ? shuffle(all).slice(0, ROUND) : shuffle(all);
    quiz.i = 0;
    quiz.right = 0;
    quiz.answered = false;
    renderCats();
    renderQuestion();
  }

  /* 이모지는 칩·배지에서 빼고 이름만 쓴다(모노크롬 톤 유지) — 칩의 아이콘은 CSS로 감춘다 */
  function catName(key) {
    const c = DATA.categories.find(x => x.key === key);
    return c ? c.name : key;
  }

  function renderQuestion() {
    const box = $("#quizStage");
    if (!box) return;
    if (!quiz.pool.length) {
      box.innerHTML = `<div class="quiz-card"><div class="quiz-q">${T("qz.noQuestion")}</div></div>`;
      return;
    }
    if (quiz.i >= quiz.pool.length) {
      box.innerHTML = `
        <div class="quiz-card quiz-done">
          <img class="quiz-done-mascot" src="${window.Icon.mascotSrc()}" alt="">
          <div class="quiz-done-t">${T("qz.doneT", { cat: quiz.cat === "all" ? T("qz.randomCat") : catName(quiz.cat) })}</div>
          <div class="quiz-done-s">${T("qz.doneS", { right: quiz.right, total: quiz.pool.length })}</div>
          ${quiz.cat === "all"
            ? `<p class="quiz-done-n">${T("qz.doneN", { all: DATA.quiz.length, round: ROUND })}</p>` : ""}
          <p class="quiz-done-w">${quiz.right === quiz.pool.length
            ? T("qz.w100")
            : quiz.right >= quiz.pool.length * 0.7 ? T("qz.w70") : T("qz.w0")}</p>
          <button type="button" class="quiz-btn primary" id="quizRestart">${window.Icon("refresh")} ${T("qz.restart")}</button>
          ${shareBlock()}
        </div>`;
      const rb = $("#quizRestart");
      if (rb) rb.addEventListener("click", () => selectCat(quiz.cat));
      bindShare();
      return;
    }

    const q = quiz.pool[quiz.i];
    box.innerHTML = `
      <div class="quiz-card">
        <div class="quiz-top">
          <span class="quiz-badge">${esc(catName(q.c))}</span>
          <span class="quiz-prog">${quiz.i + 1} / ${quiz.pool.length}</span>
        </div>
        <div class="quiz-q">${esc(q.q)}</div>
        <div class="quiz-ox">
          <button type="button" class="ox-btn o" data-ans="1"><span>O</span>${T("qz.yes")}</button>
          <button type="button" class="ox-btn x" data-ans="0"><span>X</span>${T("qz.no")}</button>
        </div>
        <div class="quiz-why hidden" id="quizWhy"></div>
      </div>`;
    quiz.answered = false;
    box.querySelectorAll("[data-ans]").forEach(b =>
      b.addEventListener("click", () => answer(b.getAttribute("data-ans") === "1", b)));
  }

  function answer(picked, btn) {
    if (quiz.answered) return;
    quiz.answered = true;
    const q = quiz.pool[quiz.i];
    const ok = picked === q.a;
    if (ok) quiz.right++;
    quiz.done++;

    const sc = loadScore();
    sc.done++; if (ok) sc.right++;
    saveScore(sc);

    const stage = $("#quizStage");
    stage.querySelectorAll(".ox-btn").forEach(b => {
      b.disabled = true;
      const isRight = (b.getAttribute("data-ans") === "1") === q.a;
      if (isRight) b.classList.add("correct");
    });
    if (!ok) btn.classList.add("wrong");

    const why = $("#quizWhy");
    why.classList.remove("hidden");
    why.innerHTML = `
      <div class="qw-head ${ok ? "ok" : "no"}">
        ${window.Icon(ok ? "check" : "ban")} ${T(ok ? "qz.right" : "qz.wrong")}
        <span class="qw-ans">${T("qz.answer", { a: T(q.a ? "qz.ansO" : "qz.ansX") })}</span>
      </div>
      <p>${esc(q.why)}</p>
      <button type="button" class="quiz-btn primary" id="quizNext">
        ${T(quiz.i + 1 >= quiz.pool.length ? "qz.result" : "qz.next")} ${window.Icon("route")}
      </button>`;
    $("#quizNext").addEventListener("click", () => { quiz.i++; renderQuestion(); });
    renderScore();
    renderInfo();
  }

  /* ══════════ 결과 SNS 공유 ══════════
   * X·페이스북은 공유 URL이 있어 새 창으로 넘기고,
   * 인스타그램은 웹 공유 URL이 없어 결과 카드 이미지를 만들어 저장 + 문구 복사로 안내한다. */
  const SITE = "https://ggagae.com";
  const TAGS = "#같이가개 #반려동물여행 #반려동물상식퀴즈 #헛걸음방지";

  function gradeOf(pct) {
    return T(pct === 100 ? "sh.grade100" : pct >= 80 ? "sh.grade80"
      : pct >= 60 ? "sh.grade60" : "sh.grade0");
  }

  /** mode "total" = 누적 기록(점수 카드에서 언제든 공유) / 기본 = 방금 끝낸 라운드 */
  function resultInfo(mode) {
    if (mode === "total") {
      const sc = loadScore();
      const total = sc.done || 1;
      const pct = Math.round((sc.right / total) * 100);
      return { label: T("sh.tipLabel"), title: T("sh.cumTitle"), total: sc.done,
               right: sc.right, pct, grade: gradeOf(pct), cum: true };
    }
    const label = quiz.cat === "all" ? T("sh.tipLabel") : catName(quiz.cat);
    const total = quiz.pool.length || 1;
    const pct = Math.round((quiz.right / total) * 100);
    return { label, title: T("sh.roundTitle", { label }), total, pct, grade: gradeOf(pct), right: quiz.right };
  }

  function shareText(mode) {
    const r = resultInfo(mode);
    const head = T(r.cum ? "sh.textCum" : "sh.textRound",
      { label: r.label, total: r.total, right: r.right, pct: r.pct, grade: r.grade });
    return `${head}\n${T("sh.textFoot")}\n${TAGS}`;
  }

  function shareBlock(mode, title) {
    return `
      <div class="share-box" data-share-mode="${mode || "round"}">
        <div class="share-t">${window.Icon("paw")} ${esc(title || T("qz.shareTitle"))}</div>
        <div class="share-btns">
          <button type="button" class="sh-btn kko" data-share="kakao" aria-label="${esc(T("sh.kakao"))}">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.5 1.7 4.7 4.2 6l-1 3.6c-.1.4.3.6.6.4l4.3-2.8c.4 0 .7.1 1.1.1 5.1 0 9.2-3.3 9.2-7.3S17.1 3 12 3Z"/></svg>
            <span>${esc(T("sh.kakao"))}</span>
          </button>
          <button type="button" class="sh-btn x" data-share="x" aria-label="X에 공유">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 3h3.3l-7.2 8.2L22 21h-6.6l-5.2-6.7L4.3 21H1l7.7-8.8L1.3 3H8l4.7 6.2L17.5 3Zm-1.2 16h1.8L7.8 4.9H5.9L16.3 19Z"/></svg>
            <span>X</span>
          </button>
          <button type="button" class="sh-btn fb" data-share="fb" aria-label="Facebook">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z"/></svg>
            <span>Facebook</span>
          </button>
          <button type="button" class="sh-btn ig" data-share="ig" aria-label="Instagram">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>
            <span>Instagram</span>
          </button>
          <button type="button" class="sh-btn link" data-share="copy" aria-label="copy">
            ${window.Icon("tag")}<span>${T("sh.copyBtn")}</span>
          </button>
        </div>
        <div class="share-msg" data-share-msg></div>
      </div>`;
  }

  /* 공유 UI가 완료 화면과 점수 카드 두 곳에 동시에 있을 수 있어
   * 안내 문구·모드는 항상 눌린 버튼이 속한 .share-box 기준으로 찾는다 */
  function shareMsg(box, html, tone) {
    const el = box && box.querySelector("[data-share-msg]");
    if (!el) return;
    el.className = "share-msg on" + (tone ? " " + tone : "");
    el.innerHTML = html;
  }

  /** 클립보드 접근이 막힌 브라우저(구형 사파리·비보안 컨텍스트)를 위한 수동 복사 */
  function manualCopy(box, lead) {
    const mode = box.getAttribute("data-share-mode");
    shareMsg(box, `${esc(lead)}
      <textarea class="share-ta" readonly rows="4">${esc(shareText(mode) + "\n" + SITE)}</textarea>`);
    const ta = box.querySelector(".share-ta");
    if (ta) { ta.focus(); ta.select(); }
  }

  function bindShare(root) {
    const scope = root || $("#quizStage");
    if (!scope) return;
    // 공유 줄이 화면에 붙는 순간 카카오 SDK를 미리 받아 둔다(클릭 후에 받으면 창이 막힌다)
    if (scope.querySelector("[data-share='kakao']") && window.PetKakao) window.PetKakao.warm();
    scope.querySelectorAll("[data-share]").forEach(b =>
      b.addEventListener("click", () => doShare(b.getAttribute("data-share"), b.closest(".share-box"))));
  }

  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch (_) {
      // 클립보드 권한이 없을 때의 폴백
      const ta = document.createElement("textarea");
      ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (_) {}
      document.body.removeChild(ta);
      return ok;
    }
  }

  async function doShare(kind, box) {
    if (!box) return;
    const mode = box.getAttribute("data-share-mode");
    const text = shareText(mode);
    if (kind === "x") {
      window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE)}`,
        "_blank", "noopener,width=600,height=640");
      return;
    }
    if (kind === "kakao") {
      const r = resultInfo(mode);
      try {
        await window.PetKakao.share({
          title: `${T("sh.tipLabel")} ${r.right}/${r.total} — ${r.grade}`,
          description: T("sh.textFoot"),
          imageUrl: `${SITE}/assets/hero-dog.jpg`,
          link: SITE,
          buttonTitle: T("sh.kakaoBtn")
        });
      } catch (_) {
        const ok = await copyText(`${text}
${SITE}`);
        if (ok) shareMsg(box, T("sh.kakaoFallback"));
        else manualCopy(box, T("sh.copyManual"));
      }
      return;
    }
    if (kind === "fb") {
      // 페이스북 sharer는 URL만 받는다 → 문구는 클립보드에 함께 담아 준다
      const ok = await copyText(`${text}\n${SITE}`);
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE)}`,
        "_blank", "noopener,width=600,height=640");
      if (ok) shareMsg(box, T("sh.copyFb"));
      else manualCopy(box, T("sh.copyFbManual"));
      return;
    }
    if (kind === "copy") {
      const ok = await copyText(`${text}\n${SITE}`);
      if (ok) shareMsg(box, T("sh.copied"), "ok");
      else manualCopy(box, T("sh.copyManual"));
      return;
    }
    if (kind === "ig") {
      shareMsg(box, `<span class="ai-spinner"></span> ${T("sh.making")}`);
      try {
        const blob = await resultImage(mode);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `가개퀴즈_결과_${resultInfo(mode).right}점.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        const ok = await copyText(`${text}\n${SITE}`);
        if (ok) shareMsg(box, T("sh.igOk"), "ok");
        else manualCopy(box, T("sh.igManual"));
      } catch (e) {
        shareMsg(box, T("sh.igFail"), "no");
      }
    }
  }

  /** 인스타그램용 정사각 결과 카드(1080×1080) 생성 */
  function resultImage(mode) {
    return new Promise((resolve, reject) => {
      const S = 1080;
      const cv = document.createElement("canvas");
      cv.width = S; cv.height = S;
      const g = cv.getContext("2d");
      const r = resultInfo(mode);

      const bg = g.createLinearGradient(0, 0, S, S);
      bg.addColorStop(0, "#F5F5F7");
      bg.addColorStop(1, "#FFFFFF");
      g.fillStyle = bg; g.fillRect(0, 0, S, S);

      // 카드 — 장식용 그라데이션 바 없이 흰 면과 헤어라인으로만
      const m = 70, cw = S - m * 2, ch = S - m * 2;
      roundRect(g, m, m, cw, ch, 44);
      g.fillStyle = "#FFFFFF"; g.fill();
      g.strokeStyle = "#E3E3E8"; g.lineWidth = 2; g.stroke();

      const cx = S / 2;
      g.textAlign = "center";
      g.fillStyle = "#1D1D1F";
      g.font = "600 44px 'Malgun Gothic', sans-serif";
      g.fillText(T("img.brand"), cx, m + 116);
      g.fillStyle = "#86868B";
      g.font = "400 26px 'Malgun Gothic', sans-serif";
      g.fillText(T("img.sub"), cx, m + 158);

      g.fillStyle = "#1D1D1F";
      g.font = "600 38px 'Malgun Gothic', sans-serif";
      g.fillText(r.title, cx, m + 238);

      // 점수 — 이 카드에서 유일하게 크게 말하는 자리
      g.fillStyle = "#1D1D1F";
      g.font = "600 150px 'Malgun Gothic', sans-serif";
      g.fillText(`${r.right} / ${r.total}`, cx, m + 400);
      g.fillStyle = "#86868B";
      g.font = "400 32px 'Malgun Gothic', sans-serif";
      g.fillText(T("img.rate", { pct: r.pct }), cx, m + 452);

      // 등급 배지
      const bw = 330, bh = 66, bx = cx - bw / 2, by = m + 492;
      roundRect(g, bx, by, bw, bh, 33);
      g.fillStyle = "#EDF8F1"; g.fill();
      g.fillStyle = "#0E7C46";
      g.font = "600 34px 'Malgun Gothic', sans-serif";
      g.fillText(r.grade, cx, by + 45);

      // 마스코트를 그린 뒤 마무리. 이미지가 안 뜨더라도 카드 생성이 멈추면 안 되므로
      // 성공·실패·지연 어느 쪽이든 한 번만 finish()로 들어가게 한다.
      let finished = false;
      const img = new Image();
      img.onload = () => {
        try {
          const iw = 225;              // 아래 안내 문구와 겹치지 않는 크기
          g.drawImage(img, cx - iw / 2, m + 575, iw, iw);
        } catch (_) {}
        finish();
      };
      img.onerror = finish;
      img.src = window.Icon.mascotSrc();
      setTimeout(finish, 2500);          // 디코딩이 지연돼도 카드는 만들어 준다

      function finish() {
        if (finished) return;
        finished = true;
        g.textAlign = "center";
        g.fillStyle = "#86868B";
        g.font = "400 27px 'Malgun Gothic', sans-serif";
        g.fillText(T("img.foot"), cx, S - m - 92);
        g.fillStyle = "#0A63CE";
        g.font = "600 30px 'Malgun Gothic', sans-serif";
        g.fillText("ggagae.com", cx, S - m - 48);
        cv.toBlob(b => b ? resolve(b) : reject(new Error("toBlob 실패")), "image/png");
      }
    });
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* 공유 UI가 라운드를 끝까지 푼 완료 화면에만 있어 사실상 안 보였다
   * → 점수 카드에서 누적 기록으로 언제든 공유할 수 있게 패널을 따로 둔다 */
  function toggleSharePanel(force, noScroll) {
    const panel = $("#sharePanel");
    if (!panel) return;
    const open = force !== undefined ? force : panel.classList.contains("hidden");
    if (!open || !loadScore().done) {
      panel.classList.add("hidden");
      panel.innerHTML = "";
      return;
    }
    panel.innerHTML = `
      <button type="button" class="share-panel-close" id="sharePanelClose" title="닫기">${window.Icon("close")}</button>
      ${shareBlock("total", T("qz.sharePanel"))}`;
    panel.classList.remove("hidden");
    $("#sharePanelClose").addEventListener("click", () => toggleSharePanel(false));
    bindShare(panel);
    if (!noScroll) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /** 누적 점수 카드 — 기록이 있으면 공유·초기화 버튼을 함께 보여 준다 */
  function renderScore(confirming) {
    const el = $("#quizScore");
    if (!el) return;
    const sc = loadScore();
    if (!sc.done) {
      el.innerHTML = `<small>${T("qz.first")}</small>`;
      toggleSharePanel(false);
      return;
    }
    if (confirming) {
      el.innerHTML = `
        <div class="qs-confirm">${T("qz.confirm", { n: sc.done })}</div>
        <div class="qs-cbtns">
          <button type="button" class="qs-btn danger" id="quizResetYes">${T("qz.confirmYes")}</button>
          <button type="button" class="qs-btn" id="quizResetNo">${T("qz.confirmNo")}</button>
        </div>`;
      $("#quizResetYes").addEventListener("click", resetScore);
      $("#quizResetNo").addEventListener("click", () => renderScore(false));
      return;
    }
    const pct = Math.round((sc.right / sc.done) * 100);
    el.innerHTML = `
      <div class="qs-main"><span class="qs-n">${sc.right}</span><span class="qs-d">/ ${sc.done}</span></div>
      <small>${T("qz.cum", { pct })}</small>
      <div class="qs-btns">
        <button type="button" class="qs-btn primary" id="quizShareBtn">${window.Icon("paw")} ${T("qz.share")}</button>
        <button type="button" class="qs-btn" id="quizResetBtn">${window.Icon("refresh")} ${T("qz.resetScore")}</button>
      </div>`;
    $("#quizShareBtn").addEventListener("click", () => toggleSharePanel());
    $("#quizResetBtn").addEventListener("click", () => renderScore(true));

    // 문제를 풀 때마다 점수가 바뀌므로, 열려 있는 패널은 최신 기록으로 갱신(스크롤은 하지 않는다)
    const panel = $("#sharePanel");
    if (panel && !panel.classList.contains("hidden")) toggleSharePanel(true, true);
  }

  /** 🔄 누적 기록 초기화 — 점수를 지우고 현재 카테고리를 새 조합으로 다시 시작 */
  function resetScore() {
    saveScore({ right: 0, done: 0 });
    quiz.right = 0;
    quiz.done = 0;
    renderScore(false);
    renderInfo();
    selectCat(quiz.cat);
  }

  function renderTipsList() {
    const box = $("#tipsList");
    if (!box) return;
    box.innerHTML = DATA.tips.map(t => `
      <div class="tip-item">
        <span class="tip-label ${TIP_TONE[t.c] || "tone-blue"}">${esc(t.label)}</span>
        <div class="tip-title">${esc(t.t)}</div>
        <p class="tip-text">${esc(t.b)}</p>
      </div>`).join("");
  }

  /* ══════════ 초기화 ══════════ */

  async function init() {
    await load();
    tipIdx = Math.floor(Math.random() * DATA.tips.length);
    renderTip();
    renderInfo();
    const tot = $("#quizTotal");
    if (tot) tot.textContent = T("tips.total", { n: DATA.quiz.length });
    renderCats();
    renderScore();
    renderTipsList();
    selectCat("all");

    const nb = $("#tipNextBtn");
    if (nb) nb.addEventListener("click", nextTip);

    // 7초마다 다음 상식으로 (홈이 보일 때만 — 다른 탭에서 헛돌지 않게)
    setInterval(() => {
      if (!$("#pageHome").classList.contains("hidden")) nextTip();
    }, 7000);
  }

  /** 🌐 언어를 바꿨을 때 자바스크립트가 그린 부분을 다시 채운다 */
  function relabel() {
    if (!DATA) return;
    const tot = $("#quizTotal");
    if (tot) tot.textContent = T("tips.total", { n: DATA.quiz.length });
    renderTip();
    renderInfo();
    renderCats();
    renderScore();
    renderTipsList();
    renderQuestion();
  }

  window.PetTips = {
    init, renderInfo, renderTip, load, resultImage, shareText, relabel,
    mascot: () => $("#quizMascot")
  };
})();
