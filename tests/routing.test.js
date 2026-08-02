const test = require("node:test");
const assert = require("node:assert/strict");

test("出入口ペアを両方向で比較し、速い向きの建物内経路を点線で描画する", async function () {
  const elements = {
    "route-distance": { textContent: "" },
    "route-duration": { textContent: "" },
    "route-mode": { textContent: "" }
  };
  const statusMessages = [];
  const drawnPolylines = [];
  const fakeMap = {
    fitBounds: function () {},
    removeLayer: function () {}
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
      setStatus: function (message, type) { statusMessages.push({ message, type }); }
    },
    storage: {
      loadSpots: function () {
        return [
          { id: "access_1", name: "出入口A", type: "access", lat: 1, lng: 1 },
          { id: "access_2", name: "出入口B", type: "access", lat: 2, lng: 2 }
        ];
      },
      loadBuildingGroups: function () {
        return [{
          id: "building_1",
          name: "近道ビル",
          pairs: [{
            id: "pair_1",
            entrySpotId: "access_1",
            exitSpotId: "access_2",
            durationMinutes: 2
          }]
        }];
      }
    }
  };
  window.ROUTEKEEPER_CONFIG = { ORS_API_KEY: "TEST_KEY" };

  global.L = {
    marker: function () {
      return {
        bindPopup: function () { return this; },
        addTo: function () { return this; },
        setLatLng: function () {}
      };
    },
    geoJSON: function (feature) {
      return { feature: feature, addTo: function () { return this; }, getBounds: function () { return {}; } };
    },
    polyline: function (points, options) {
      drawnPolylines.push({ points, options });
      return { addTo: function () { return this; } };
    },
    featureGroup: function () {
      return { addTo: function () { return this; }, getBounds: function () { return {}; } };
    }
  };

  global.fetch = async function (url, options) {
    const coordinates = JSON.parse(options.body).coordinates;
    const start = coordinates[0].join(",");
    const end = coordinates[1].join(",");
    let duration = 1200;
    let distance = 2000;
    if ((start === "0,0" && end === "2,2") || (start === "1,1" && end === "10,10")) {
      duration = 300;
      distance = 500;
    }
    return {
      ok: true,
      json: async function () {
        return {
          features: [{
            geometry: { type: "LineString", coordinates: coordinates },
            properties: { summary: { duration: duration, distance: distance } }
          }]
        };
      }
    };
  };

  delete require.cache[require.resolve("../js/routing.js")];
  require("../js/routing.js");
  await RouteKeeper.routing.searchWalkingRoute({ lat: 10, lng: 10 });

  assert.equal(elements["route-duration"].textContent, "12 分");
  assert.equal(elements["route-mode"].textContent, "近道ビル経由");
  assert.equal(drawnPolylines.length, 1);
  assert.equal(drawnPolylines[0].options.dashArray, "10 10");
  assert.deepEqual(drawnPolylines[0].points, [[2, 2], [1, 1]]);
  assert.match(statusMessages.at(-1).message, /近道ビル/);
});
