/**
 * Shared defaults (safe to commit). Do not put your Mapbox token here.
 * Copy config.secret.example.js to config.secret.js and add your token there
 * (config.secret.js is gitignored).
 *
 * Mapbox: https://account.mapbox.com/access-tokens/
 */
window.FUEL_FINDER_CONFIG = {
  mapboxAccessToken: "",
  mapCenter: { lng: -83.9207, lat: 35.9606 },
  mapZoom: 11,
  gasStationLimit: 25,
};
