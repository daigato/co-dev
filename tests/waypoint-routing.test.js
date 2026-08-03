const test = require("node:test");
const assert = require("node:assert/strict");

test("登録済み経由地を追加して区間を再計算し、経路終了で状態を消去する", async function () {
  const clearButton = { disabled: true, addEventListener: function () {} };
  const elements = {
    "route-distance": { textContent: "" },
    "route-duration": { textContent: "" },
    "route-mode": { textContent: "" },
    "route-clear-button": clearButton
  };
  const requestedCoordinates = [];
  const removedLayers = [];
  const fakeMap = {
    fitBounds: function () {},
    removeLayer: function (layer) { removedLayers.push(layer); }
  };

  global.window = global;
  global.document = {
    getElementById: function (id) { return elements[id] || null; },
    addEventListener: function () {}
  };
  global.RouteKeeper = {
    state: { currentPosition: { lat: 0, lng: 0 } },
    map: {
      getMap: function () { return fakeMap; },
      setStatus: function () {}
    },
    storage: {
      loadSpots: function () { return []; },
      loadBuildingGroups: function () { return []; }
    }
  };
  window.ROUTEKEEPER_CONFIG = { ORS_API_KEY: "TEST_KEY" };

  const destinationMarker = {
    bindPopup: function () { return this; },
    addTo: function () { return this; },
    setLatLng: function () {}
  };
  global.L = {
    marker: function () { return destinationMarker; },
    geoJSON: function () { return {}; },
    polyline: function () { return {}; },
    featureGroup: function () {
      return { addTo: function () { return this; }, getBounds: function () { return {}; } };
    }
  };

  global.fetch = async function (url, options) {
    const coordinates = JSON.parse(options.body).coordinates;
    requestedCoordinates.push(coordinates);
    return {
      ok: true,
      json: async function () {
        return {
          features: [{
            geometry: { type: "LineString", coordinates: coordinates },
            properties: { summary: { duration: 600, distance: 1000 } }
          }]
        };
      }
    };
  };

  delete require.cache[require.resolve("../js/routing.js")];
  require("../js/routing.js");

  await RouteKeeper.routing.searchWalkingRoute({ lat: 10, lng: 10 });
  await RouteKeeper.routing.addWaypoint({ id: "way_1", label: "経由地A", lat: 5, lng: 5 });

  assert.deepEqual(requestedCoordinates.slice(-2), [
    [[0, 0], [5, 5]],
    [[5, 5], [10, 10]]
  ]);
  assert.equal(elements["route-duration"].textContent, "20 分");
  assert.equal(elements["route-mode"].textContent, "通常ルート・経由地1件");
  assert.equal(clearButton.disabled, false);
  assert.equal(RouteKeeper.routing.getRouteState().waypoints.length, 1);

  RouteKeeper.routing.clearRoute();

  assert.equal(RouteKeeper.routing.getRouteState().destination, null);
  assert.deepEqual(RouteKeeper.routing.getRouteState().waypoints, []);
  assert.equal(elements["route-duration"].textContent, "--");
  assert.equal(clearButton.disabled, true);
  assert.ok(removedLayers.length >= 2);
});
