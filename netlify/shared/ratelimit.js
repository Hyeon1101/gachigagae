/* ─────────────────────────────────────────────────────────────
 * 아주 단순한 호출 제한 — 돈이 나가는 주소 앞에 세운다.
 *
 * /api/ai 는 키 없이 누구나 부를 수 있는 주소다. CORS 는 브라우저 안에서만
 * 막아 주므로 curl 한 줄이면 그대로 통과한다. 제한이 없으면 남이 우리
 * Gemini 요금을 대신 태울 수 있고, 그러면 진짜 사용자 쪽이 먼저 막힌다.
 *
 * 기록은 컨테이너 메모리에만 남는다 → 인스턴스가 여러 개면 각자 센다.
 * 완벽한 방어는 아니지만 "한 곳에서 마구 두드리는" 가장 흔한 남용은 끊긴다.
 * 더 정밀하게 막아야 하면 Netlify Blobs 같은 공용 저장소로 옮기면 된다.
 * ───────────────────────────────────────────────────────────── */
const hits = new Map();   // ip → 최근 요청 시각 배열

/** 프록시를 거쳐도 진짜 호출자를 찾는다 (Netlify 가 넣어 주는 헤더가 가장 정확) */
function clientIp(event) {
  const h = (event && event.headers) || {};
  const raw = h["x-nf-client-connection-ip"] || h["client-ip"] ||
              h["x-forwarded-for"] || h["X-Forwarded-For"] || "";
  return String(raw).split(",")[0].trim() || "unknown";
}

/**
 * 한 번 쓴다. 한도를 넘었으면 ok:false 와 다시 시도할 시각(초)을 준다.
 * @param {object} event  Netlify Function 이벤트
 * @param {{limit?:number, windowMs?:number, maxKeys?:number}} opt
 */
function take(event, opt) {
  const o = opt || {};
  const limit = o.limit || 20;
  const windowMs = o.windowMs || 60000;
  const maxKeys = o.maxKeys || 5000;

  const ip = clientIp(event);
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);

  // 서로 다른 IP 가 쏟아져도 메모리가 무한히 늘지 않게 한 번씩 비운다
  if (hits.size > maxKeys) hits.clear();

  if (arr.length >= limit) {
    hits.set(ip, arr);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - arr[0])) / 1000)) };
  }
  arr.push(now);
  hits.set(ip, arr);
  return { ok: true, remaining: limit - arr.length };
}

module.exports = { take, clientIp };
