/**
 * Local token override (NOT committed).
 *
 * 1. Copy this file to config.secret.js in the same folder.
 * 2. Paste your Mapbox public access token below.
 * 3. If this token was ever pushed to GitHub, revoke it in Mapbox and create a new one.
 *
 * Mapbox: https://account.mapbox.com/access-tokens/
 * Turn on URL restrictions for your token so it only works on your deployed domain.
 */
(function () {
  var base = window.FUEL_FINDER_CONFIG || {};
  window.FUEL_FINDER_CONFIG = Object.assign({}, base, {
    mapboxAccessToken: "",
  });
})();
