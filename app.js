/**
 * KnoxFuel prototype — screen flow and station data aligned with Figma frames.
 */

/** Full review text shown in “More Info” on My Reviews */
const USER_REVIEWS = {
  weigels: {
    title: "Weigel’s on Chapman Hwy",
    date: "March 2, 2026",
    stars: 5,
    mapTier: "green",
    cleanliness: 5,
    pumpAvailability: 5,
    safety: 4,
    text:
      "Always clean restrooms and the pumps are usually free when I swing by after class. Rewards actually add up here. Only nitpick is the lot gets tight when the food side is busy.",
  },
  gasngo: {
    title: "Gas ‘N Go on Western Ave",
    date: "February 18, 2026",
    stars: 5,
    mapTier: "yellow",
    cleanliness: 5,
    pumpAvailability: 4,
    safety: 4,
    text:
      "Price matched what the app said and the attendant was quick when I had a pump issue. I’d stop again if I’m on Western—just wish the lighting by the air/water island was a bit brighter at night.",
  },
  citgo: {
    title: "CitGo on Sevier Ave",
    date: "January 9, 2026",
    stars: 3,
    mapTier: "red",
    cleanliness: 3,
    pumpAvailability: 4,
    safety: 3,
    text:
      "Convenient near downtown but it’s often the highest price in the radius. Pumps worked fine; store felt cramped. I left this review mainly to warn others to compare prices before filling up here.",
  },
};

/** Matches map marker color (price + rating tier): green / yellow / red */
/** Mapbox sheet tier copy (must match mapbox-map.js TIER_BADGE) */
const MAPBOX_TIER_BADGE = {
  green: "Low price vs. other pins on this map",
  yellow: "Average vs. other pins on this map",
  red: "High price vs. other pins on this map",
};

const SHEET_PRICE_TIER_CLASSES = [
  "sheet--price-green",
  "sheet--price-yellow",
  "sheet--price-red",
];
const SHEET_MASCOT_TIER_CLASSES = [
  "sheet__mascot--green",
  "sheet__mascot--yellow",
  "sheet__mascot--red",
];

function setStationSheetPriceTier(tierOrNull) {
  const sheet = $("#station-sheet");
  SHEET_PRICE_TIER_CLASSES.forEach((c) => sheet.classList.remove(c));
  if (tierOrNull) {
    sheet.classList.add(`sheet--price-${tierOrNull}`);
  }
}

function setStationSheetMascotTier(tierOrNull) {
  const mascot = $("#station-mascot");
  if (!mascot) return;
  SHEET_MASCOT_TIER_CLASSES.forEach((c) => mascot.classList.remove(c));
  mascot.classList.add(`sheet__mascot--${tierOrNull || "yellow"}`);
}

const STATIONS = {
  citgo: {
    name: "CITGO on Sevier Ave",
    price: "$3.89/gal",
    badge: "High for this area",
    stars: 3,
    mapTier: "red",
  },
  gasngo: {
    name: "Gas ‘N Go on Western Ave",
    price: "$3.79/gal",
    badge: "Average for this area",
    stars: 5,
    mapTier: "yellow",
  },
  weigels: {
    name: "Weigel’s on Chapman Hwy",
    price: "$3.70/gal",
    badge: "Good for this area",
    stars: 5,
    mapTier: "green",
  },
};

const STATION_DETAILS = {
  citgo: {
    rewards: "Yes",
    pumps: "8-12",
    location: "<5 miles",
    membership: "Not Required",
    reviews: [
      {
        author: "Alex M.",
        stars: 3,
        text: "Easy to access from Sevier Ave, but prices are usually higher than nearby options.",
      },
      {
        author: "Priya S.",
        stars: 2,
        text: "Pumps worked fine, but the lot felt crowded at peak time and lighting could be better.",
      },
    ],
  },
  gasngo: {
    rewards: "Yes",
    pumps: "12-16",
    location: "5-10 miles",
    membership: "Not Required",
    reviews: [
      {
        author: "Darnell T.",
        stars: 4,
        text: "Solid pricing and I rarely wait long. Store staff was helpful when my receipt did not print.",
      },
      {
        author: "Mia R.",
        stars: 5,
        text: "Clean station and consistent prices. Good stop when I am heading west.",
      },
    ],
  },
  weigels: {
    rewards: "Yes",
    pumps: "12-16",
    location: "<5 miles",
    membership: "Not Required",
    reviews: [
      {
        author: "Jordan C.",
        stars: 5,
        text: "Usually the best value in this area, and pumps move quickly even during rush hour.",
      },
      {
        author: "Sam L.",
        stars: 4,
        text: "Clean and well lit. Rewards discounts are noticeable if you fuel up often.",
      },
    ],
  },
};

function $(sel, root = document) {
  return root.querySelector(sel);
}

function showView(id) {
  closeReviewModal();
  document.querySelectorAll(".view").forEach((el) => {
    const on = el.id === id;
    el.classList.toggle("is-hidden", !on);
    el.setAttribute("aria-hidden", on ? "false" : "true");
  });
  if (id === "view-map" && window.KnoxFuelMapbox) {
    window.KnoxFuelMapbox.onViewShown();
  }
}

function openRateOverlay() {
  const rateView = $("#view-rate");
  if (!rateView) return;
  rateView.classList.remove("is-hidden");
  rateView.setAttribute("aria-hidden", "false");
}

function closeRateOverlay() {
  const rateView = $("#view-rate");
  if (!rateView) return;
  rateView.classList.add("is-hidden");
  rateView.setAttribute("aria-hidden", "true");
}

function inferStationKeyFromName(name = "") {
  const normalized = String(name).toLowerCase();
  if (normalized.includes("weigel")) return "weigels";
  if (normalized.includes("gas")) return "gasngo";
  if (normalized.includes("citgo")) return "citgo";
  return "citgo";
}

function stationKeyFromSheet() {
  const sheet = $("#station-sheet");
  if (!sheet) return "citgo";
  if (sheet.dataset.station && STATION_DETAILS[sheet.dataset.station]) {
    return sheet.dataset.station;
  }
  return inferStationKeyFromName($("#station-name")?.textContent || "");
}

function starText(count) {
  const safe = Math.max(0, Math.min(5, Number(count) || 0));
  return `${"★".repeat(safe)}${"☆".repeat(5 - safe)}`;
}

function averageRatingText(reviews) {
  if (!reviews || !reviews.length) return "0.0 / 5 (☆☆☆☆☆)";
  const total = reviews.reduce((sum, review) => sum + (Number(review.stars) || 0), 0);
  const avg = total / reviews.length;
  const roundedToWhole = Math.max(0, Math.min(5, Math.round(avg)));
  return `${avg.toFixed(1)} / 5 (${starText(roundedToWhole)})`;
}

function openStationInfoView() {
  const key = stationKeyFromSheet();
  const details = STATION_DETAILS[key] || STATION_DETAILS.citgo;

  $("#station-info-name").textContent = $("#station-name")?.textContent || STATIONS[key].name;
  $("#station-info-price").textContent = $("#station-price")?.textContent || STATIONS[key].price;
  $("#station-info-badge").textContent = $("#station-badge")?.textContent || STATIONS[key].badge;

  $("#station-info-rewards").textContent = details.rewards;
  $("#station-info-pumps").textContent = details.pumps;
  $("#station-info-location").textContent = details.location;
  $("#station-info-membership").textContent = details.membership;
  $("#station-info-average-rating").textContent = averageRatingText(details.reviews);

  const reviewsEl = $("#station-info-reviews");
  reviewsEl.innerHTML = "";
  details.reviews.forEach((review) => {
    const item = document.createElement("article");
    item.className = "community-review";
    item.innerHTML = `
      <div class="community-review__head">
        <p class="community-review__author">${review.author}</p>
        <p class="community-review__stars" aria-label="${review.stars} out of 5 stars">${starText(review.stars)}</p>
      </div>
      <p class="community-review__body">${review.text}</p>
    `;
    reviewsEl.appendChild(item);
  });

  closeStationSheet();
  showView("view-station-info");
}

function renderStars(container, count, max = 5) {
  container.innerHTML = "";
  for (let i = 1; i <= max; i++) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", `star ${i > count ? "star--empty" : ""}`);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "fill",
      i <= count ? "currentColor" : "none"
    );
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute(
      "d",
      "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
    );
    svg.appendChild(path);
    container.appendChild(svg);
  }
}

function fillReviewStars() {
  document.querySelectorAll(".stars[data-rating]").forEach((el) => {
    const n = parseInt(el.getAttribute("data-rating"), 10) || 5;
    renderStars(el, n);
  });
}

/**
 * @param {string | object} placeOrKey — demo key or Mapbox Search GeoJSON Feature
 */
function openStationSheet(placeOrKey) {
  const sheet = $("#station-sheet");
  const isMapboxFeature =
    placeOrKey &&
    placeOrKey.type === "Feature" &&
    placeOrKey.properties &&
    placeOrKey.properties.mapbox_id;

  if (isMapboxFeature) {
    const p = placeOrKey.properties;
    const meta = placeOrKey._knoxFuelMeta || {};
    const price = meta.pricePerGal;
    const tier = meta.tier;

    const displayName = p.name_preferred || p.name || "Gas station";
    $("#station-name").textContent = displayName;
    if (price != null && !Number.isNaN(Number(price))) {
      $("#station-price").textContent = `$${Number(price).toFixed(2)}/gal`;
    } else {
      $("#station-price").textContent = "—";
    }
    $("#station-badge").textContent =
      meta.tierBadge ||
      (tier && MAPBOX_TIER_BADGE[tier]) ||
      MAPBOX_TIER_BADGE.yellow;

    const streetAddr =
      p.address ||
      ((p.context &&
        p.context.address &&
        (p.context.address.name ||
          [
            p.context.address.address_number,
            p.context.address.street_name,
          ]
            .filter(Boolean)
            .join(" "))) ||
        "");
    const brandStr =
      Array.isArray(p.brand) && p.brand.length ? p.brand.join(" · ") : "";
    const catStr =
      Array.isArray(p.poi_category) && p.poi_category.length
        ? p.poi_category
            .filter((c) => !/^gas[\s_-]*station$/i.test(String(c || "").trim()))
            .join(", ")
        : "";
    const ctx = p.context || {};
    const areaHint = [ctx.locality, ctx.place, ctx.region]
      .map((layer) => (layer && layer.name ? layer.name : ""))
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(", ");
    const noteParts = [];
    if (streetAddr) noteParts.push(streetAddr);
    else if (areaHint) noteParts.push(areaHint);
    if (brandStr) noteParts.push(brandStr);
    if (catStr) noteParts.push(catStr);

    const noteEl = $("#station-price-note");
    if (noteEl) {
      noteEl.textContent = noteParts.join(" · ");
      noteEl.hidden = noteParts.length === 0;
    }

    const starCount =
      tier === "green" ? 5 : tier === "yellow" ? 3 : tier === "red" ? 2 : 4;
    renderStars($("#station-stars"), starCount);

    setStationSheetPriceTier(tier || null);
    setStationSheetMascotTier(tier || "yellow");

    const coords = placeOrKey.geometry.coordinates;
    sheet.dataset.mode = "mapbox";
    sheet.dataset.lng = String(coords[0]);
    sheet.dataset.lat = String(coords[1]);
    sheet.dataset.mapboxId = p.mapbox_id || "";
    sheet.dataset.station = "";
  } else {
    const key = typeof placeOrKey === "string" ? placeOrKey : "citgo";
    const data = STATIONS[key] || STATIONS.citgo;
    $("#station-name").textContent = data.name;
    $("#station-price").textContent = data.price;
    $("#station-badge").textContent = data.badge;
    renderStars($("#station-stars"), data.stars);
    setStationSheetMascotTier(data.mapTier || "yellow");
    sheet.dataset.mode = "demo";
    sheet.dataset.station = key;
    delete sheet.dataset.lng;
    delete sheet.dataset.lat;
    delete sheet.dataset.mapboxId;
    const noteEl = $("#station-price-note");
    if (noteEl) {
      noteEl.textContent = "";
      noteEl.hidden = true;
    }
    setStationSheetPriceTier(null);
  }

  sheet.classList.remove("is-hidden");
}

function closeStationSheet() {
  $("#station-sheet").classList.add("is-hidden");
  setStationSheetPriceTier(null);
  const noteEl = $("#station-price-note");
  if (noteEl) {
    noteEl.textContent = "";
    noteEl.hidden = true;
  }
}

window.openStationSheet = openStationSheet;
window.closeStationSheet = closeStationSheet;

function closeAllFilterAccordions(root = document) {
  root.querySelectorAll(".filter-accordion.is-open").forEach((item) => {
    item.classList.remove("is-open");
    const panel = item.querySelector(".filter-dropdown");
    const btn = item.querySelector(".filter-row");
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  });
}

function openReviewModal(reviewId) {
  const data = USER_REVIEWS[reviewId];
  if (!data) return;

  $("#review-detail-title").textContent = data.title;
  $("#review-detail-date").textContent = data.date;
  $("#review-detail-body").textContent = data.text;
  renderStars($("#review-detail-stars"), data.stars);

  const scaleLabel = (n) => `${n} / 5`;
  $("#review-detail-cleanliness").textContent = scaleLabel(data.cleanliness);
  $("#review-detail-pump").textContent = scaleLabel(data.pumpAvailability);
  $("#review-detail-safety").textContent = scaleLabel(data.safety);

  const modal = $("#review-detail-modal");
  const panel = $("#review-detail-panel");
  const tier = data.mapTier || STATIONS[reviewId]?.mapTier || "yellow";

  const tierClasses = ["modal--map-green", "modal--map-yellow", "modal--map-red"];
  const panelTierClasses = [
    "modal__panel--map-green",
    "modal__panel--map-yellow",
    "modal__panel--map-red",
  ];
  tierClasses.forEach((c) => modal.classList.remove(c));
  if (panel) {
    panelTierClasses.forEach((c) => panel.classList.remove(c));
    panel.classList.add(`modal__panel--map-${tier}`);
  }
  modal.classList.add(`modal--map-${tier}`);
  modal.dataset.mapTier = tier;

  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
  $("#review-detail-close").focus();
}

function closeReviewModal() {
  const modal = $("#review-detail-modal");
  const panel = $("#review-detail-panel");
  if (!modal) return;
  modal.classList.remove("modal--map-green", "modal--map-yellow", "modal--map-red");
  if (panel) {
    panel.classList.remove(
      "modal__panel--map-green",
      "modal__panel--map-yellow",
      "modal__panel--map-red"
    );
  }
  delete modal.dataset.mapTier;
  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");
}

function initReviewDetailModal() {
  document.querySelectorAll(".review-card .review-card__more").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".review-card");
      const id = card && card.getAttribute("data-review-id");
      if (id) openReviewModal(id);
    });
  });

  const modal = $("#review-detail-modal");
  if (!modal) return;

  $("#review-detail-close").addEventListener("click", closeReviewModal);
  modal.querySelector(".modal__backdrop").addEventListener("click", closeReviewModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("is-hidden")) {
      closeReviewModal();
    }
  });
}

function initRateStarPicker() {
  const row = $("#rate-overall-stars");
  if (!row) return;
  const buttons = row.querySelectorAll(".rate-star-btn");
  let value = 4;

  function apply() {
    buttons.forEach((btn, i) => {
      const on = i < value;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-checked", value === i + 1 ? "true" : "false");
    });
    row.setAttribute("aria-valuenow", String(value));
  }

  buttons.forEach((btn, i) => {
    btn.setAttribute("role", "radio");
    btn.addEventListener("click", () => {
      value = i + 1;
      apply();
    });
  });

  apply();
}

function bindRateRangeDisplay(inputId, displayId) {
  const input = document.getElementById(inputId);
  const display = document.getElementById(displayId);
  if (!input || !display) return;

  function sync() {
    const v = input.value;
    display.textContent = v;
    input.setAttribute("aria-valuetext", `${v} out of 5`);
  }

  input.addEventListener("input", sync);
  sync();
}

function initFilterAccordions() {
  const container = $("#view-filters");
  if (!container) return;

  container.querySelectorAll(".filter-accordion .filter-row").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".filter-accordion");
      const panel = item.querySelector(".filter-dropdown");
      if (!panel) return;

      const wasOpen = item.classList.contains("is-open");
      closeAllFilterAccordions(container);

      if (!wasOpen) {
        item.classList.add("is-open");
        panel.hidden = false;
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
}

function init() {
  fillReviewStars();

  $("#view-splash").addEventListener("click", () => {
    showView("view-map");
  });

  $("#btn-map-reset")?.addEventListener("click", () => {
    if (window.KnoxFuelMapbox && typeof window.KnoxFuelMapbox.resetToDefaultView === "function") {
      window.KnoxFuelMapbox.resetToDefaultView();
    }
  });

  $("#close-station").addEventListener("click", closeStationSheet);

  document.querySelectorAll(".btn-filters").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeStationSheet();
      const rateView = $("#view-rate");
      if (rateView && !rateView.classList.contains("is-hidden")) {
        closeRateOverlay();
      }
      showView("view-filters");
    });
  });

  document.querySelectorAll(".btn-nav-map").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeStationSheet();
      const rateView = $("#view-rate");
      if (rateView && !rateView.classList.contains("is-hidden")) {
        closeRateOverlay();
      }
      showView("view-map");
    });
  });

  document.querySelectorAll(".btn-nav-profile").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      closeStationSheet();
      const rateView = $("#view-rate");
      if (rateView && !rateView.classList.contains("is-hidden")) {
        closeRateOverlay();
      }
      showView("view-reviews");
    });
  });

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-back");
      if (target === "map") {
        closeStationSheet();
        const rateView = $("#view-rate");
        if (rateView && !rateView.classList.contains("is-hidden")) {
          closeRateOverlay();
        }
        showView("view-map");
      }
      if (target === "filters") showView("view-filters");
    });
  });

  initFilterAccordions();
  initReviewDetailModal();
  initRateStarPicker();
  bindRateRangeDisplay("rate-clean", "rate-clean-display");
  bindRateRangeDisplay("rate-pump", "rate-pump-display");
  bindRateRangeDisplay("rate-safe", "rate-safe-display");

  $("#btn-search-filters").addEventListener("click", () => {
    showView("view-map");
  });

  $("#btn-directions").addEventListener("click", () => {
    const sheet = $("#station-sheet");
    const lat = sheet.dataset.lat;
    const lng = sheet.dataset.lng;
    if (lat && lng) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } else {
      alert("Directions would open in Maps (prototype).");
    }
  });

  $("#btn-rate-from-sheet").addEventListener("click", () => {
    closeStationSheet();
    openRateOverlay();
  });

  $("#btn-station-more-info").addEventListener("click", openStationInfoView);

  $("#btn-done-rate").addEventListener("click", () => {
    closeRateOverlay();
  });

}

document.addEventListener("DOMContentLoaded", init);
