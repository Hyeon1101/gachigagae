/* ─────────────────────────────────────────────────────────────
 * 지도 어댑터: 카카오맵(키 있으면) ↔ Leaflet/OSM(폴백)
 * 동일 인터페이스: init, setCenter, addMarker, clearMarkers, fitAll
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  /* 지도 위에서는 판정이 한눈에 구분돼야 하므로 UI보다 채도를 조금 높게 잡되,
   * 디자인 시스템과 같은 계열을 쓴다(관광지는 보조 정보라 중립 회색). */
  const MARKER_COLOR = { ok: "#0E8A50", cond: "#C07C1E", no: "#C4362D", unknown: "#0A63CE", attraction: "#8E8E93" };

  /* 핀 이미지 캐시 — 마커마다 SVG 인코딩을 새로 하면 수백 개부터 급격히 느려진다 */
  const pinCache = {};
  function pinSvg(color, emoji) {
    const k = color + emoji;
    if (pinCache[k]) return pinCache[k];
    return (pinCache[k] = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
        <path d="M17 0C7.6 0 0 7.6 0 17c0 12.7 17 27 17 27s17-14.3 17-27C34 7.6 26.4 0 17 0z" fill="${color}"/>
        <circle cx="17" cy="16" r="11" fill="white"/>
        <text x="17" y="21" font-size="13" text-anchor="middle">${emoji}</text>
      </svg>`));
  }

  /* ── 카카오맵 어댑터 ── */
  function KakaoAdapter(el, cfg) {
    this.markers = [];
    this.map = new kakao.maps.Map(el, {
      center: new kakao.maps.LatLng(cfg.DEFAULT_CENTER.lat, cfg.DEFAULT_CENTER.lng),
      level: 7
    });
    this.map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
  }
  KakaoAdapter.prototype = {
    name: "카카오맵",
    setCenter(lat, lng, zoomIn) {
      this.map.setCenter(new kakao.maps.LatLng(lat, lng));
      if (zoomIn) this.map.setLevel(4);
    },
    addMarker(lat, lng, { status = "unknown", emoji = "🐾", title = "", onClick }) {
      // MarkerImage 인스턴스도 캐시 (수천 개 생성 시 비용이 크다)
      const key = status + emoji;
      if (!this._imgCache) this._imgCache = {};
      const img = this._imgCache[key] || (this._imgCache[key] = new kakao.maps.MarkerImage(
        pinSvg(MARKER_COLOR[status] || MARKER_COLOR.unknown, emoji),
        new kakao.maps.Size(34, 44), { offset: new kakao.maps.Point(17, 44) }));
      const mk = new kakao.maps.Marker({
        map: this.map, position: new kakao.maps.LatLng(lat, lng), image: img, title
      });
      if (onClick) kakao.maps.event.addListener(mk, "click", onClick);
      this.markers.push(mk);
      return mk;
    },
    clearMarkers() { this.markers.forEach(m => m.setMap(null)); this.markers = []; },
    fitAll(points) {
      if (!points.length) return;
      const b = new kakao.maps.LatLngBounds();
      points.forEach(p => b.extend(new kakao.maps.LatLng(p.lat, p.lng)));
      this.map.setBounds(b, 40);
    },
    invalidate() { this.map.relayout(); }
  };

  /* ── Leaflet/OSM 어댑터 ── */
  function LeafletAdapter(el, cfg) {
    this.markers = [];
    // preferCanvas: 원형 마커를 캔버스에 그려 DOM 노드 폭증을 막는다(대량 표시 필수)
    this.map = L.map(el, { preferCanvas: true })
      .setView([cfg.DEFAULT_CENTER.lat, cfg.DEFAULT_CENTER.lng], cfg.DEFAULT_ZOOM);
    // CARTO Voyager: 무료·무키, 깔끔한 스타일 + 한글 지명 (실패 시 OSM 기본 타일)
    const carto = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
    });
    carto.on("tileerror", () => {
      if (this._fellBack) return;
      this._fellBack = true;
      carto.remove();
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "&copy; OpenStreetMap"
      }).addTo(this.map);
    });
    carto.addTo(this.map);
  }
  LeafletAdapter.prototype = {
    name: "오픈맵 (카카오맵 활성화 시 자동 전환)",
    setCenter(lat, lng, zoomIn) { this.map.setView([lat, lng], zoomIn ? 16 : this.map.getZoom()); },
    addMarker(lat, lng, { status = "unknown", emoji = "🐾", title = "", onClick, simple = false }) {
      const color = MARKER_COLOR[status] || MARKER_COLOR.unknown;
      let mk;
      if (simple) {
        // 대량 표시용 경량 마커 (캔버스에 그려짐)
        mk = L.circleMarker([lat, lng], {
          radius: 6, color: "#fff", weight: 1.5, fillColor: color, fillOpacity: .95
        }).addTo(this.map);
        if (title) mk.bindTooltip(title, { direction: "top" });
      } else {
        const icon = L.icon({ iconUrl: pinSvg(color, emoji), iconSize: [34, 44], iconAnchor: [17, 44] });
        mk = L.marker([lat, lng], { icon, title }).addTo(this.map);
      }
      if (onClick) mk.on("click", onClick);
      this.markers.push(mk);
      return mk;
    },
    clearMarkers() { this.markers.forEach(m => m.remove()); this.markers = []; },
    fitAll(points) {
      if (!points.length) return;
      this.map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [40, 40] });
    },
    /** 숨겨진 상태로 생성된 지도는 표시 후 크기를 다시 계산해야 한다 */
    invalidate() { this.map.invalidateSize(); }
  };

  /* onerror 는 "연결이 끊겼다"에는 반응하지만 "응답이 영영 안 온다"에는
   * 반응하지 않는다. 모바일에서 신호가 약하면 여기서 그대로 멈춰 지도가
   * 끝내 안 뜨므로, 시한을 두고 실패로 넘긴다. */
  function loadScript(src, ms = 8000) {
    return new Promise((ok, no) => {
      const s = document.createElement("script");
      let done = false;
      const finish = (fn, arg) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        fn(arg);
      };
      const timer = setTimeout(() => {
        s.remove();                       // 다음 후보를 깨끗한 상태에서 시도하도록
        finish(no, new Error(`스크립트 시간 초과: ${src}`));
      }, ms);
      s.src = src;
      s.onload = () => finish(ok);
      s.onerror = () => { s.remove(); finish(no, new Error(`스크립트 로드 실패: ${src}`)); };
      document.head.appendChild(s);
    });
  }
  function loadCss(href) {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href;
    document.head.appendChild(l);
  }

  /** 약속한 시간 안에 안 끝나면 실패로 처리 — 폴백으로 넘어가기 위한 장치 */
  function deadline(promise, ms, what) {
    return Promise.race([
      promise,
      new Promise((_, no) => setTimeout(() => no(new Error(`${what} 시간 초과(${ms}ms)`)), ms))
    ]);
  }

  /** 지도 초기화: 카카오 키(복수 후보 순차 시도) → 카카오맵, 모두 실패 시 Leaflet OSM */
  async function createMap(el, cfg) {
    const keys = (cfg.KAKAO_JS_KEYS || (cfg.KAKAO_JS_KEY ? [cfg.KAKAO_JS_KEY] : [])).filter(Boolean);
    for (const key of keys) {
      try {
        await loadScript(`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`);

        /* ⚠️ sdk.js 는 도메인이 등록돼 있지 않아도 200 으로 내려온다(실측).
         * 등록되지 않은 도메인이면 그 다음 내부 요청이 401 로 막히는데, 그때
         * kakao.maps.load 의 콜백이 **영영 호출되지 않는다**. 시한이 없으면
         * 여기서 계속 기다리다가 지도가 끝내 안 뜬다 — 폴백도 못 간다.
         * (앱은 오리진이 https://localhost 라 카카오 콘솔에 이 주소가 등록돼
         *  있지 않으면 정확히 이 경로를 탄다) */
        await deadline(new Promise(res => kakao.maps.load(res)), 7000, "카카오맵 초기화");

        // 콜백이 왔어도 실제로 쓸 수 있는지 확인하고 넘긴다
        if (!window.kakao || !kakao.maps || typeof kakao.maps.Map !== "function") {
          throw new Error("kakao.maps 가 초기화되지 않음");
        }
        return new KakaoAdapter(el, cfg);
      } catch (e) {
        console.warn(`카카오맵 키(${key.slice(0, 6)}…) 사용 불가 → 다음 후보/폴백:`, (e && e.message) || e);
      }
    }
    console.info("카카오맵을 쓸 수 없어 오픈맵(OSM)으로 표시합니다.");
    try {
      loadCss("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
      await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", 12000);
      return new LeafletAdapter(el, cfg);
    } catch (e) {
      /* 오픈맵 라이브러리까지 못 받으면(망이 막힌 곳) 예전엔 여기서 예외가 그대로 올라가
       * 지도 기능 전체가 멈췄다 → 아무것도 그리지 않는 빈 지도로 넘기고, 목록·상세·길안내는
       * 그대로 쓰게 둔다. */
      console.warn("오픈맵도 불러오지 못했습니다 — 지도 없이 진행:", (e && e.message) || e);
      return new NullAdapter();
    }
  }

  /* ── 지도 없음(모든 지도 실패) — 같은 인터페이스, 아무 일도 하지 않는다 ── */
  function NullAdapter() { this.markers = []; }
  NullAdapter.prototype = {
    name: "지도를 불러오지 못했어요 — 목록의 길안내 버튼을 이용해 주세요",
    setCenter() {},
    addMarker() { return null; },
    clearMarkers() {},
    fitAll() {},
    invalidate() {}
  };

  window.PetMapAdapter = { createMap };
})();
