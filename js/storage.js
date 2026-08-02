window.RouteKeeper = window.RouteKeeper || {};

// 担当B：LocalStorageへのスポット保存と読み込みを実装します。
RouteKeeper.storage = RouteKeeper.storage || {};

const STORAGE_KEY = "routekeeper.spots.v1";
const BUILDING_GROUPS_STORAGE_KEY = "routekeeper.building-groups.v1";

/**
 * LocalStorageからスポット配列を取得します。
 * @returns {Array} スポットの配列。存在しない、またはパースエラーの場合は空配列。
 */
RouteKeeper.storage.loadSpots = function () {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return [];
    }
    const spots = JSON.parse(data);
    if (!Array.isArray(spots)) {
      return [];
    }
    var migrated = false;
    var normalizedSpots = spots.map(function (spot) {
      if (spot && (spot.type === "entry" || spot.type === "exit")) {
        migrated = true;
        return Object.assign({}, spot, { type: "access" });
      }
      return spot;
    });
    if (migrated) {
      RouteKeeper.storage.saveSpots(normalizedSpots);
    }
    return normalizedSpots;
  } catch (error) {
    console.error("LocalStorageからのスポット読み込みに失敗しました:", error);
    return [];
  }
};

/**
 * スポット配列をLocalStorageに保存します。
 * @param {Array} spots - 保存するスポットの配列
 */
RouteKeeper.storage.saveSpots = function (spots) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spots));
  } catch (error) {
    console.error("LocalStorageへのスポット保存に失敗しました:", error);
  }
};

/**
 * 保存されているスポットデータをすべて消去します。
 */
RouteKeeper.storage.clearSpots = function () {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("LocalStorageのデータ消去に失敗しました:", error);
  }
};

/**
 * 新しいスポットを追加して保存します。
 * @param {Object} spot - 追加するスポットオブジェクト
 */
RouteKeeper.storage.addSpot = function (spot) {
  const spots = RouteKeeper.storage.loadSpots();
  spots.push(spot);
  RouteKeeper.storage.saveSpots(spots);
};

/**
 * 指定したIDのスポットを削除して保存します。
 * @param {string} id - 削除するスポットのID
 */
RouteKeeper.storage.deleteSpot = function (id) {
  const spots = RouteKeeper.storage.loadSpots();
  const filteredSpots = spots.filter(function (spot) {
    return spot.id !== id;
  });
  RouteKeeper.storage.saveSpots(filteredSpots);
};

RouteKeeper.storage.loadBuildingGroups = function () {
  try {
    const data = localStorage.getItem(BUILDING_GROUPS_STORAGE_KEY);
    if (!data) {
      return [];
    }
    const groups = JSON.parse(data);
    return Array.isArray(groups) ? groups : [];
  } catch (error) {
    console.error("建物グループの読み込みに失敗しました:", error);
    return [];
  }
};

RouteKeeper.storage.saveBuildingGroups = function (groups) {
  try {
    localStorage.setItem(BUILDING_GROUPS_STORAGE_KEY, JSON.stringify(groups));
  } catch (error) {
    console.error("建物グループの保存に失敗しました:", error);
  }
};

RouteKeeper.storage.clearBuildingGroups = function () {
  try {
    localStorage.removeItem(BUILDING_GROUPS_STORAGE_KEY);
  } catch (error) {
    console.error("建物グループの消去に失敗しました:", error);
  }
};

RouteKeeper.storage.removeSpotFromBuildingGroups = function (spotId) {
  const groups = RouteKeeper.storage.loadBuildingGroups();
  const updatedGroups = groups.map(function (group) {
    return Object.assign({}, group, {
      pairs: (Array.isArray(group.pairs) ? group.pairs : []).filter(function (pair) {
        return pair.entrySpotId !== spotId && pair.exitSpotId !== spotId;
      })
    });
  }).filter(function (group) {
    return group.pairs.length > 0;
  });
  RouteKeeper.storage.saveBuildingGroups(updatedGroups);
  return updatedGroups;
};

