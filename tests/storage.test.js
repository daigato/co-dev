const test = require("node:test");
const assert = require("node:assert/strict");

test("スポット削除時に関連する建物ペアと空グループも削除する", function () {
  const values = new Map();
  global.window = global;
  global.RouteKeeper = {};
  global.localStorage = {
    getItem: function (key) { return values.has(key) ? values.get(key) : null; },
    setItem: function (key, value) { values.set(key, value); },
    removeItem: function (key) { values.delete(key); }
  };

  delete require.cache[require.resolve("../js/storage.js")];
  require("../js/storage.js");

  RouteKeeper.storage.saveBuildingGroups([
    {
      id: "building_1",
      name: "テスト棟",
      pairs: [
        { id: "pair_1", entrySpotId: "entry_1", exitSpotId: "exit_1", durationMinutes: 3 }
      ]
    }
  ]);

  const remaining = RouteKeeper.storage.removeSpotFromBuildingGroups("entry_1");
  assert.deepEqual(remaining, []);
  assert.deepEqual(RouteKeeper.storage.loadBuildingGroups(), []);
});

test("旧入口・出口タイプを出入口タイプへ移行して保存する", function () {
  const values = new Map([
    ["routekeeper.spots.v1", JSON.stringify([
      { id: "entry_1", name: "旧入口", type: "entry", lat: 1, lng: 1 },
      { id: "exit_1", name: "旧出口", type: "exit", lat: 2, lng: 2 },
      { id: "way_1", name: "経由地", type: "way", lat: 3, lng: 3 }
    ])]
  ]);
  global.window = global;
  global.RouteKeeper = {};
  global.localStorage = {
    getItem: function (key) { return values.has(key) ? values.get(key) : null; },
    setItem: function (key, value) { values.set(key, value); },
    removeItem: function (key) { values.delete(key); }
  };

  delete require.cache[require.resolve("../js/storage.js")];
  require("../js/storage.js");

  const spots = RouteKeeper.storage.loadSpots();
  assert.deepEqual(spots.map(function (spot) { return spot.type; }), ["access", "access", "way"]);
  assert.deepEqual(
    JSON.parse(values.get("routekeeper.spots.v1")).map(function (spot) { return spot.type; }),
    ["access", "access", "way"]
  );
});
