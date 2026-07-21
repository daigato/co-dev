window.RouteKeeper = window.RouteKeeper || {};

document.addEventListener("DOMContentLoaded", function () {
  // 未実装の関数があっても、ほかの初期化を止めないための呼び出し枠です。
  function callIfAvailable(moduleName, functionName) {
    var module = RouteKeeper[moduleName];

    if (!module || typeof module[functionName] !== "function") {
      return;
    }

    try {
      module[functionName]();
    } catch (error) {
      console.error(
        moduleName + "." + functionName + " の初期化に失敗しました。",
        error
      );
    }
  }

  callIfAvailable("map", "initMap");
  callIfAvailable("spots", "renderSpotList");
});
