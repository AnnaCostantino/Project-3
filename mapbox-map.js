/**
 * Mapbox GL JS map + Search Box API gas_station category (real POI locations).
 */
(function () {
  const CFG = window.FUEL_FINDER_CONFIG || {};
  let map = null;
  let mapMarkers = [];
  let mapReady = false;

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

  function fetchGasStations(token, center, limit) {
    const url = new URL(
      "https://api.mapbox.com/search/searchbox/v1/category/gas_station"
    );
    url.searchParams.set("access_token", token);
    url.searchParams.set("proximity", `${center.lng},${center.lat}`);
    url.searchParams.set("limit", String(Math.min(25, Math.max(1, limit || 25))));
    url.searchParams.set("language", "en");
    return fetch(url.toString()).then((r) => {
      if (!r.ok) {
        return r.text().then((t) => {
          throw new Error(t || r.statusText);
        });
      }
      return r.json();
    });
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
      el.setAttribute(
        "aria-label",
        `${(feature.properties && feature.properties.name) || "Gas station"}, $${price.toFixed(2)} per gallon`
      );

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        feature._fuelFinderMeta = {
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
    const token = (CFG.mapboxAccessToken || "").trim();
    const center = CFG.mapCenter || { lng: -83.9207, lat: 35.9606 };
    const zoom = CFG.mapZoom != null ? CFG.mapZoom : 11;

    if (!token) {
      showMapStatus(
        "Add your Mapbox access token to config.js (see config.example.js)."
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
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("click", () => {
      if (typeof window.closeStationSheet === "function") {
        window.closeStationSheet();
      }
    });

    fetchGasStations(token, center, CFG.gasStationLimit)
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

  window.FuelFinderMapbox = {
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
        window.FuelFinderMapbox.initWhenReady();
      }
    },
  };
})();
