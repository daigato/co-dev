window.RouteKeeper = window.RouteKeeper || {};

// 担当B：LocalStorageへのスポット保存と読み込みを実装します。
RouteKeeper.storage = RouteKeeper.storage || {};

const STORAGE_KEY = "routekeeper.spots.v1";

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
    return Array.isArray(spots) ? spots : [];
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

const API_KEY_STORAGE_KEY = "routekeeper.config.api_key";

/**
 * LocalStorageからAPIキーを取得します。
 * @returns {string} 保存されているAPIキー。存在しない場合は空文字列。
 */
RouteKeeper.storage.loadApiKey = function () {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
  } catch (error) {
    console.error("LocalStorageからのAPIキー読み込みに失敗しました:", error);
    return "";
  }
};

/**
 * APIキーをLocalStorageに保存します。
 * @param {string} apiKey - 保存するAPIキー
 */
RouteKeeper.storage.saveApiKey = function (apiKey) {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  } catch (error) {
    console.error("LocalStorageへのAPIキー保存に失敗しました:", error);
  }
};

