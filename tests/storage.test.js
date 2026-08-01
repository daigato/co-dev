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
