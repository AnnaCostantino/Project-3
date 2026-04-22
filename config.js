/**
 * Shared defaults (safe to commit). Do not put your Mapbox token here.
 * Copy config.secret.example.js to config.secret.js and add your token there
 * (config.secret.js is gitignored).
 *
 * Mapbox: https://account.mapbox.com/access-tokens/
 */
window.KNOX_FUEL_CONFIG = {
  mapboxAccessToken: "",
  mapCenter: { lng: -83.9207, lat: 35.9606 },
  mapZoom: 11,
  /** Per Mapbox Search Box category request (maximum 25). */
  gasStationLimit: 25,
  /** After merging several proximity-biased requests, cap how many pins to show. */
  gasStationMaxPins: 100,
  /**
   * Distances in km: 0 = map center only; each positive value adds 8 compass probes
   * (N, NE, …) so the API returns different stations near Knoxville. Example [0, 4, 8]
   * uses 17 requests × up to 25 results, deduped by Mapbox place id.
   */
  gasStationProximityRingsKm: [0, 4, 8],
  /** Half-width of the search bbox from map center (km); limits results to the metro area. */
  gasStationBboxHalfKm: 22,
};
