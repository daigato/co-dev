window.RouteKeeper = window.RouteKeeper || {};

// 担当A：Leaflet地図、現在地、スポット地点の表示を管理します。
RouteKeeper.map = (function () {
  "use strict";

  var map = null;
  var currentPositionMarker = null;
  var spotNodeLayer = null;
  var DEFAULT_CENTER = [35.681236, 139.767125];
  var DEFAULT_ZOOM = 13;

  function setStatus(message) {
    var status = document.getElementById("status-message");
    if (status) {
      status.textContent = message;
    }
  }

  function initMap() {
    if (map) {
      return map;
    }

    var mapElement = document.getElementById("map");
    if (!mapElement) {
      throw new Error("地図表示領域が見つかりません。");
    }
    if (typeof L === "undefined") {
      setStatus("地図ライブラリを読み込めませんでした。通信環境を確認してください。");
      throw new Error("Leaflet is not available.");
    }

    mapElement.replaceChildren();
    map = L.map(mapElement).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    spotNodeLayer = L.layerGroup().addTo(map);
    map.on("click", handleMapClick);

    var currentLocationButton = document.getElementById("current-location-button");
    if (currentLocationButton) {
      currentLocationButton.addEventListener("click", function () {
        getCurrentPosition({ moveMap: true }).catch(function () {
          // エラーメッセージは getCurrentPosition 内で表示します。
        });
      });
    }

    setStatus("地図を読み込みました。地図をクリックすると徒歩ルートを検索します。");
    return map;
  }

  function handleMapClick(event) {
    if (
      RouteKeeper.state.mode === "registration" &&
      RouteKeeper.spots &&
      typeof RouteKeeper.spots.handleMapClick === "function"
    ) {
      RouteKeeper.spots.handleMapClick(event.latlng);
      return;
    }

    if (
      RouteKeeper.routing &&
      typeof RouteKeeper.routing.searchWalkingRoute === "function"
    ) {
      RouteKeeper.routing.searchWalkingRoute(event.latlng);
    }
  }

  function getMap() {
    return map;
  }

  function getCurrentPosition(options) {
    var settings = options || {};

    if (!navigator.geolocation) {
      setStatus("このブラウザは現在地取得に対応していません。");
      return Promise.reject(new Error("Geolocation is not supported."));
    }

    setStatus("現在地を取得しています…");

    return new Promise(function (resolve, reject) {
      navigator.geolocation.getCurrentPosition(
        function (position) {
          var latlng = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          RouteKeeper.state.currentPosition = latlng;
          showCurrentPosition(latlng);
          if (settings.moveMap !== false) {
            map.setView([latlng.lat, latlng.lng], 16);
          }
          setStatus("現在地を表示しました。");
          resolve(latlng);
        },
        function (error) {
          var messages = {
            1: "現在地の利用が許可されていません。ブラウザの設定を確認してください。",
            2: "現在地を取得できませんでした。電波状況を確認してください。",
            3: "現在地の取得がタイムアウトしました。もう一度お試しください。"
          };
          setStatus(messages[error.code] || "現在地を取得できませんでした。");
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );
    });
  }

  function showCurrentPosition(latlng) {
    if (!map) {
      return;
    }

    if (currentPositionMarker) {
      currentPositionMarker.setLatLng(latlng);
      return;
    }

    currentPositionMarker = L.circleMarker(latlng, {
      radius: 8,
      color: "#ffffff",
      weight: 3,
      fillColor: "#2878d0",
      fillOpacity: 1
    })
      .bindPopup("現在地")
      .addTo(map);
  }

  function showSpotNodes(spot) {
    clearSpotNodes();
    if (!map || !spot || !spot.nodes) {
      return;
    }

    var nodes = [];
    if (spot.nodes.entrance) {
      nodes.push(spot.nodes.entrance);
    }
    if (Array.isArray(spot.nodes.waypoints)) {
      nodes = nodes.concat(spot.nodes.waypoints);
    }
    if (spot.nodes.exit) {
      nodes.push(spot.nodes.exit);
    }

    var bounds = [];
    nodes.forEach(function (node, index) {
      if (!Number.isFinite(Number(node.lat)) || !Number.isFinite(Number(node.lng))) {
        return;
      }

      var latlng = [Number(node.lat), Number(node.lng)];
      var label = node.label || "地点" + (index + 1);
      L.marker(latlng).bindPopup(label).bindTooltip(label).addTo(spotNodeLayer);
      bounds.push(latlng);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 17);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  }

  function clearSpotNodes() {
    if (spotNodeLayer) {
      spotNodeLayer.clearLayers();
    }
  }

  return {
    initMap: initMap,
    getMap: getMap,
    getCurrentPosition: getCurrentPosition,
    showSpotNodes: showSpotNodes,
    clearSpotNodes: clearSpotNodes
  };
})();
