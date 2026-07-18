window.RouteKeeper = window.RouteKeeper || {};

// 地図担当とスポット担当が共有する、アプリ全体の状態です。
RouteKeeper.state = {
  mode: "route",
  currentPosition: null,
  selectedSpotId: null,
  draftSpot: null
};
