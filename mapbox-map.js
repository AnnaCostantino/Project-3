/**
 * Mapbox GL JS map + Search Box API gas_station category (real POI locations).
 */
(function () {
  let map = null;
  let mapMarkers = [];
  let mapReady = false;

  function getConfig() {
    return window.KNOX_FUEL_CONFIG || {};
  }

  /**
   * Search Box /reverse: first hit with `properties.address` (number + street per API docs)
   * or `context.address` parts. Tries `types=address` first, then an unrestricted query.
   * @param {number} lng
   * @param {number} lat
   * @returns {Promise<string | null>}
   */
  function fetchStreetLineFromSearchBoxReverse(lng, lat) {
    const token = (getConfig().mapboxAccessToken || "").trim();
    if (!token) return Promise.resolve(null);

    function pickLine(fc) {
      if (!fc || !fc.features || !fc.features.length) return null;
      for (let i = 0; i < fc.features.length; i++) {
        const p = fc.features[i].properties;
        if (!p) continue;
        const addr = p.address;
        if (addr && String(addr).trim()) return String(addr).trim();
      }
      for (let i = 0; i < fc.features.length; i++) {
        const p = fc.features[i].properties;
        if (!p || !p.context || !p.context.address) continue;
        const a = p.context.address;
        const n = a.address_number;
        const st = a.street_name;
        if (n != null && String(n).trim() !== "" || (st && String(st).trim() !== "")) {
          return [n, st]
            .filter((x) => x != null && String(x).trim() !== "")
            .map((x) => String(x).trim())
            .join(" ");
        }
        if (a.name && String(a.name).trim()) return String(a.name).trim();
      }
      return null;
    }

    function doReverse(extraTypes) {
      const url = new URL("https://api.mapbox.com/search/searchbox/v1/reverse");
      url.searchParams.set("longitude", String(lng));
      url.searchParams.set("latitude", String(lat));
      url.searchParams.set("limit", "8");
      url.searchParams.set("language", "en");
      url.searchParams.set("country", "US");
      url.searchParams.set("access_token", token);
      if (extraTypes) url.searchParams.set("types", extraTypes);
      return fetch(url.toString())
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => pickLine(data));
    }

    return doReverse("address")
      .then((line) => (line ? line : doReverse(null)))
      .catch(() => null);
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function djb2(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = (h * 33) ^ str.charCodeAt(i);
    }
    return Math.abs(h);
  }

  /**
   * Synthetic $/gal (Mapbox does not return live pump prices).
   * Varies by station id; ranked vs other pins on this map for colors.
   */
  function syntheticPricePerGal(feature) {
    const id =
      (feature.properties && feature.properties.mapbox_id) ||
      `${feature.geometry.coordinates[0]},${feature.geometry.coordinates[1]}`;
    const h = djb2(String(id));
    const cents = 279 + (h % 131);
    return cents / 100;
  }

  const TIER_BADGE = {
    green: "Low price vs. other pins on this map",
    yellow: "Average vs. other pins on this map",
    red: "High price vs. other pins on this map",
  };

  function priceTierForRank(rank, n) {
    if (n <= 1) return "green";
    const gEnd = Math.ceil(n / 3);
    const yEnd = Math.ceil((2 * n) / 3);
    if (rank < gEnd) return "green";
    if (rank < yEnd) return "yellow";
    return "red";
  }

  function enrichFeaturesWithPricesAndTiers(fc) {
    const items = (fc.features || [])
      .filter((f) => f.geometry && f.geometry.coordinates)
      .map((feature) => ({
        feature,
        price: syntheticPricePerGal(feature),
      }))
      .sort((a, b) => {
        if (a.price !== b.price) return a.price - b.price;
        const ida =
          (a.feature.properties && a.feature.properties.mapbox_id) || "";
        const idb =
          (b.feature.properties && b.feature.properties.mapbox_id) || "";
        return ida.localeCompare(idb);
      });

    const n = items.length;
    items.forEach((item, rank) => {
      item.tier = priceTierForRank(rank, n);
    });

    return items;
  }

  function showMapStatus(message) {
    const el = document.getElementById("map-status");
    if (el) {
      el.textContent = message;
      el.hidden = false;
    }
  }

  function hideMapStatus() {
    const el = document.getElementById("map-status");
    if (el) el.hidden = true;
  }

  function clearDomMarkers() {
    mapMarkers.forEach((m) => m.remove());
    mapMarkers = [];
  }

  /**
   * Apply a soft light-green treatment to basemap layers only.
   * Custom gas station markers are DOM overlays and remain unchanged.
   */
  function applyLightGreenMapTheme(targetMap) {
    if (!targetMap || !targetMap.getStyle) return;
    const style = targetMap.getStyle();
    const layers = (style && style.layers) || [];

    layers.forEach((layer) => {
      const id = layer.id;
      const type = layer.type;

      try {
        if (type === "background") {
          targetMap.setPaintProperty(id, "background-color", "#e9f7e9");
          targetMap.setPaintProperty(id, "background-opacity", 0.9);
          return;
        }

        if (type === "fill") {
          targetMap.setPaintProperty(id, "fill-color", "#d6efd6");
          targetMap.setPaintProperty(id, "fill-opacity", 0.72);
          return;
        }

        if (type === "line") {
          targetMap.setPaintProperty(id, "line-color", "#a7d4a7");
          targetMap.setPaintProperty(id, "line-opacity", 0.68);
          return;
        }

        if (type === "symbol") {
          targetMap.setPaintProperty(id, "icon-color", "#76b676");
          targetMap.setPaintProperty(id, "text-color", "#4f8f4f");
          targetMap.setPaintProperty(id, "icon-opacity", 0.82);
          targetMap.setPaintProperty(id, "text-opacity", 0.82);
          return;
        }

        if (type === "circle") {
          targetMap.setPaintProperty(id, "circle-color", "#7abb7a");
          targetMap.setPaintProperty(id, "circle-stroke-color", "#4e934e");
          targetMap.setPaintProperty(id, "circle-opacity", 0.8);
          targetMap.setPaintProperty(id, "circle-stroke-opacity", 0.8);
          return;
        }

        if (type === "fill-extrusion") {
          targetMap.setPaintProperty(id, "fill-extrusion-color", "#cde8cd");
          targetMap.setPaintProperty(id, "fill-extrusion-opacity", 0.7);
          return;
        }

        if (type === "raster") {
          targetMap.setPaintProperty(id, "raster-opacity", 0.72);
          targetMap.setPaintProperty(id, "raster-saturation", -0.35);
          targetMap.setPaintProperty(id, "raster-brightness-min", 0.15);
          targetMap.setPaintProperty(id, "raster-brightness-max", 0.95);
          return;
        }

        if (type === "hillshade") {
          targetMap.setPaintProperty(id, "hillshade-highlight-color", "#d7f0d7");
          targetMap.setPaintProperty(id, "hillshade-shadow-color", "#8fbe8f");
          targetMap.setPaintProperty(id, "hillshade-accent-color", "#b6ddb6");
        }
      } catch (_err) {
        // Ignore unsupported paint properties on specific style layers.
      }
    });
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function configureMapMotion(targetMap, containerEl) {
    if (!targetMap) return;

    if (targetMap.scrollZoom) {
      targetMap.scrollZoom.setWheelZoomRate(1 / 700);
      targetMap.scrollZoom.setZoomRate(1 / 110);
    }

    if (targetMap.dragPan) {
      targetMap.dragPan.enable({
        linearity: 0.25,
        easing: easeOutCubic,
        deceleration: 2200,
        maxSpeed: 1400,
      });
    }

    if (containerEl) {
      const setNavigating = () => containerEl.classList.add("map__surface--navigating");
      const clearNavigating = () =>
        requestAnimationFrame(() =>
          containerEl.classList.remove("map__surface--navigating")
        );

      targetMap.on("movestart", setNavigating);
      targetMap.on("zoomstart", setNavigating);
      targetMap.on("moveend", clearNavigating);
      targetMap.on("zoomend", clearNavigating);
    }
  }

  /** @param {{ lng: number, lat: number }} center */
  function bboxStringFromCenterKm(center, halfWidthKm) {
    const lat = center.lat;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const dLat = halfWidthKm / 111;
    const dLng = halfWidthKm / (111 * Math.max(0.2, cosLat));
    const minLng = center.lng - dLng;
    const minLat = center.lat - dLat;
    const maxLng = center.lng + dLng;
    const maxLat = center.lat + dLat;
    return `${minLng},${minLat},${maxLng},${maxLat}`;
  }

  /**
   * Destination point given start, initial bearing (deg), and distance (km).
   * @returns {{ lng: number, lat: number }}
   */
  function destinationPointKm(lat, lng, bearingDeg, distanceKm) {
    const R = 6371;
    const δ = distanceKm / R;
    const θ = (bearingDeg * Math.PI) / 180;
    const φ1 = (lat * Math.PI) / 180;
    const λ1 = (lng * Math.PI) / 180;
    const sinφ1 = Math.sin(φ1);
    const cosφ1 = Math.cos(φ1);
    const sinδ = Math.sin(δ);
    const cosδ = Math.cos(δ);
    const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
    const φ2 = Math.asin(sinφ2);
    const y = Math.sin(θ) * sinδ * cosφ1;
    const x = cosδ - sinφ1 * sinφ2;
    const λ2 = λ1 + Math.atan2(y, x);
    const lat2 = (φ2 * 180) / Math.PI;
    let lng2 = (λ2 * 180) / Math.PI;
    lng2 = ((((lng2 + 540) % 360) + 360) % 360) - 180;
    return { lat: lat2, lng: lng2 };
  }

  /**
   * Build proximity bias points: ring 0 = center; each km>0 adds 8 compass offsets.
   * @param {{ lng: number, lat: number }} center
   * @param {number[]} ringsKm e.g. [0, 4, 8]
   */
  function buildProximityProbes(center, ringsKm) {
    const probes = [];
    const seen = new Set();
    function pushProbe(p) {
      const key = `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`;
      if (seen.has(key)) return;
      seen.add(key);
      probes.push(p);
    }

    (ringsKm || [0]).forEach((km) => {
      if (km === 0) {
        pushProbe({ lng: center.lng, lat: center.lat });
        return;
      }
      for (let b = 0; b < 8; b++) {
        const p = destinationPointKm(center.lat, center.lng, b * 45, km);
        pushProbe(p);
      }
    });
    return probes;
  }

  function featureDedupeKey(f) {
    const id = f.properties && f.properties.mapbox_id;
    if (id) return `id:${id}`;
    const c = f.geometry && f.geometry.coordinates;
    if (!c) return `x:${Math.random()}`;
    return `ll:${c[0].toFixed(5)},${c[1].toFixed(5)}`;
  }

  /**
   * Merge several category responses: unique by mapbox_id, closest-to-center first, then cap.
   */
  function mergeCategoryResults(featureCollections, center, maxPins) {
    const byKey = new Map();
    featureCollections.forEach((fc) => {
      if (!fc || !fc.features) return;
      fc.features.forEach((f) => {
        if (!f.geometry || !f.geometry.coordinates) return;
        const k = featureDedupeKey(f);
        const [lng, lat] = f.geometry.coordinates;
        const dist = haversineKm(center.lat, center.lng, lat, lng);
        const prev = byKey.get(k);
        if (!prev || dist < prev.dist) {
          byKey.set(k, { feature: f, dist });
        }
      });
    });

    const merged = Array.from(byKey.values())
      .sort((a, b) => a.dist - b.dist)
      .slice(0, Math.max(1, maxPins))
      .map((x) => x.feature);

    return {
      type: "FeatureCollection",
      features: merged,
    };
  }

  function fetchGasStationCategoryOnce(token, proximity, limit, bboxStr) {
    const url = new URL(
      "https://api.mapbox.com/search/searchbox/v1/category/gas_station"
    );
    url.searchParams.set("access_token", token);
    url.searchParams.set("proximity", `${proximity.lng},${proximity.lat}`);
    url.searchParams.set("limit", String(Math.min(25, Math.max(1, limit || 25))));
    url.searchParams.set("language", "en");
    url.searchParams.set("country", "US");
    if (bboxStr) {
      url.searchParams.set("bbox", bboxStr);
    }
    return fetch(url.toString()).then((r) => {
      if (!r.ok) {
        return r.text().then((t) => {
          throw new Error(t || r.statusText);
        });
      }
      return r.json();
    });
  }

  /**
   * Several proximity-biased category calls (25 results each) to cover more POIs than a single request.
   */
  async function fetchGasStationsMerged(token, center, cfg) {
    const perReq = Math.min(25, Math.max(1, cfg.gasStationLimit || 25));
    const maxPins = Math.min(200, Math.max(10, cfg.gasStationMaxPins || 100));
    const rings = Array.isArray(cfg.gasStationProximityRingsKm)
      ? cfg.gasStationProximityRingsKm
      : [0, 4, 8];
    const halfKm =
      cfg.gasStationBboxHalfKm != null ? Number(cfg.gasStationBboxHalfKm) : 22;
    const bboxStr = Number.isFinite(halfKm) && halfKm > 0
      ? bboxStringFromCenterKm(center, halfKm)
      : "";

    const probes = buildProximityProbes(center, rings);
    const batchSize = 5;
    const collections = [];

    for (let i = 0; i < probes.length; i += batchSize) {
      const batch = probes.slice(i, i + batchSize);
      const settled = await Promise.allSettled(
        batch.map((p) => fetchGasStationCategoryOnce(token, p, perReq, bboxStr))
      );
      settled.forEach((s) => {
        if (s.status === "fulfilled" && s.value && s.value.features) {
          collections.push(s.value);
        } else if (s.status === "rejected") {
          console.warn("Gas station category request failed:", s.reason);
        }
      });
      if (i + batchSize < probes.length) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    const merged = mergeCategoryResults(collections, center, maxPins);
    return merged;
  }

  function addMarkersFromGeoJSON(fc, center) {
    clearDomMarkers();
    if (!fc || !fc.features || !map) return;

    const items = enrichFeaturesWithPricesAndTiers(fc);

    items.forEach((item) => {
      const { feature, price, tier } = item;
      const coords = feature.geometry.coordinates;
      const [lng, lat] = coords;
      const dist = haversineKm(center.lat, center.lng, lat, lng);

      const el = document.createElement("button");
      el.type = "button";
      el.className = `map-marker map-marker--${tier}`;
      const labelName =
        (feature.properties &&
          (feature.properties.name_preferred || feature.properties.name)) ||
        "Gas station";
      el.setAttribute(
        "aria-label",
        `${labelName}, $${price.toFixed(2)} per gallon`
      );

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        feature._knoxFuelMeta = {
          distKm: dist,
          tier,
          pricePerGal: price,
          tierBadge: TIER_BADGE[tier],
        };
        if (typeof window.openStationSheet === "function") {
          window.openStationSheet(feature);
        }
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map);
      mapMarkers.push(marker);
    });
  }

  function initMapInternal() {
    const CFG = getConfig();
    const token = (CFG.mapboxAccessToken || "").trim();
    const center = CFG.mapCenter || { lng: -83.9207, lat: 35.9606 };
    const zoom = CFG.mapZoom != null ? CFG.mapZoom : 11;

    if (!token) {
      const onGitHubPages =
        typeof location !== "undefined" &&
        /\.github\.io$/i.test(location.hostname || "");
      showMapStatus(
        onGitHubPages
          ? "Mapbox token missing on this deploy. Confirm Settings → Pages uses \"GitHub Actions\" (not a branch), add Actions secret MAPBOX_TOKEN (exact name), then re-run the Deploy GitHub Pages workflow."
          : "Add your Mapbox access token to config.secret.js (copy config.secret.example.js)."
      );
      return;
    }

    mapboxgl.accessToken = token;

    const container = document.getElementById("mapbox-map");
    if (!container || map) return;

    map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [center.lng, center.lat],
      zoom,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    configureMapMotion(map, container);

    map.on("load", () => {
      applyLightGreenMapTheme(map);
    });

    map.on("click", () => {
      if (typeof window.closeStationSheet === "function") {
        window.closeStationSheet();
      }
    });

    showMapStatus("Loading gas stations from Mapbox…");
    fetchGasStationsMerged(token, center, CFG)
      .then((data) => {
        if (data && data.features && data.features.length) {
          addMarkersFromGeoJSON(data, center);
          hideMapStatus();
        } else {
          showMapStatus(
            "No gas stations returned for this area. Try another zoom or location."
          );
        }
      })
      .catch((err) => {
        console.warn(err);
        showMapStatus(
          "Could not load gas stations. Check your token and Search Box API access."
        );
      });

    mapReady = true;
  }

  function resize() {
    if (map && mapReady) {
      map.resize();
    }
  }

  function resetToDefaultView() {
    if (!map || !mapReady) return;
    const CFG = getConfig();
    const c = CFG.mapCenter || { lng: -83.9207, lat: 35.9606 };
    const z = CFG.mapZoom != null ? CFG.mapZoom : 11;
    map.easeTo({
      center: [c.lng, c.lat],
      zoom: z,
      duration: 900,
    });
  }

  window.KnoxFuelMapbox = {
    initWhenReady() {
      if (mapReady) {
        resize();
        return;
      }
      initMapInternal();
      setTimeout(resize, 150);
    },

    onViewShown() {
      if (mapReady) {
        setTimeout(resize, 100);
      } else {
        window.KnoxFuelMapbox.initWhenReady();
      }
    },

    /** Search Box reverse geocode — number + street when available. */
    fetchStreetLineAt(lng, lat) {
      return fetchStreetLineFromSearchBoxReverse(lng, lat);
    },

    resetToDefaultView,
  };
})();
