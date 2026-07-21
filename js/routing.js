window.RouteKeeper = window.RouteKeeper || {};

// 担当A：OpenRouteServiceの徒歩ルート検索と表示を管理します。
RouteKeeper.routing = (function () {
  "use strict";

  var routeLayer = null;
  var destinationMarker = null;
  var activeRequest = null;
  var API_URL =
    "https://api.openrouteservice.org/v2/directions/foot-walking/geojson";

  function setStatus(message) {
    var status = document.getElementById("status-message");
    if (status) {
      status.textContent = message;
    }
  }

  function updateRouteInfo(distanceMeters, durationSeconds) {
    var distanceElement = document.getElementById("route-distance");
    var durationElement = document.getElementById("route-duration");

    if (distanceElement) {
      distanceElement.textContent =
        distanceMeters == null ? "--" : formatDistance(distanceMeters);
    }
    if (durationElement) {
      durationElement.textContent =
        durationSeconds == null ? "--" : formatDuration(durationSeconds);
    }
  }

  function formatDistance(meters) {
    if (meters < 1000) {
      return Math.round(meters) + " m";
    }
    return (meters / 1000).toFixed(1) + " km";
  }

  function formatDuration(seconds) {
    var minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60) {
      return minutes + " 分";
    }

    var hours = Math.floor(minutes / 60);
    var remainingMinutes = minutes % 60;
    return remainingMinutes ? hours + " 時間 " + remainingMinutes + " 分" : hours + " 時間";
  }

  async function searchWalkingRoute(destination) {
    var map = RouteKeeper.map && RouteKeeper.map.getMap();
    if (!map) {
      setStatus("地図の初期化が完了していません。");
      return;
    }

    var destinationLatLng = normalizeLatLng(destination);
    if (!destinationLatLng) {
      setStatus("目的地の座標が正しくありません。");
      return;
    }

    var apiKey =
      window.ROUTEKEEPER_CONFIG && window.ROUTEKEEPER_CONFIG.ORS_API_KEY;
    if (!apiKey || apiKey === "YOUR_API_KEY") {
      setStatus("OpenRouteServiceのAPIキーを js/config.js に設定してください。");
      showDestination(destinationLatLng);
      return;
    }

    var currentPosition = RouteKeeper.state.currentPosition;
    if (!currentPosition) {
      try {
        currentPosition = await RouteKeeper.map.getCurrentPosition({ moveMap: false });
      } catch (error) {
        return;
      }
    }

    clearRoute();
    var requestController = new AbortController();
    activeRequest = requestController;
    showDestination(destinationLatLng);
    setStatus("徒歩ルートを検索しています…");

    try {
      var response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Accept: "application/geo+json, application/json",
          Authorization: apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          coordinates: [
            [Number(currentPosition.lng), Number(currentPosition.lat)],
            [destinationLatLng.lng, destinationLatLng.lat]
          ]
        }),
        signal: requestController.signal
      });

      if (!response.ok) {
        throw new Error("OpenRouteService error: " + response.status);
      }

      var geojson = await response.json();
      var feature = geojson.features && geojson.features[0];
      if (!feature || !feature.geometry) {
        throw new Error("ルートが見つかりませんでした。");
      }

      routeLayer = L.geoJSON(feature, {
        style: {
          color: "#1769d2",
          weight: 6,
          opacity: 0.85
        }
      }).addTo(map);
      map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });

      var summary = feature.properties && feature.properties.summary;
      updateRouteInfo(summary && summary.distance, summary && summary.duration);
      setStatus("徒歩ルートを表示しました。");
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      console.error("徒歩ルートの検索に失敗しました。", error);
      updateRouteInfo(null, null);
      setStatus("徒歩ルートを取得できませんでした。APIキーや通信環境を確認してください。");
    } finally {
      if (activeRequest === requestController) {
        activeRequest = null;
      }
    }
  }

  function normalizeLatLng(value) {
    if (!value || !Number.isFinite(Number(value.lat)) || !Number.isFinite(Number(value.lng))) {
      return null;
    }
    return { lat: Number(value.lat), lng: Number(value.lng) };
  }

  function showDestination(latlng) {
    var map = RouteKeeper.map.getMap();
    if (!map) {
      return;
    }
    if (destinationMarker) {
      destinationMarker.setLatLng(latlng);
    } else {
      destinationMarker = L.marker(latlng).bindPopup("目的地").addTo(map);
    }
  }

  function clearRoute() {
    var map = RouteKeeper.map && RouteKeeper.map.getMap();
    if (activeRequest) {
      activeRequest.abort();
      activeRequest = null;
    }
    if (map && routeLayer) {
      map.removeLayer(routeLayer);
    }
    if (map && destinationMarker) {
      map.removeLayer(destinationMarker);
    }
    routeLayer = null;
    destinationMarker = null;
    updateRouteInfo(null, null);
  }

  return {
    searchWalkingRoute: searchWalkingRoute,
    clearRoute: clearRoute
  };
})();
