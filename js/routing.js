window.RouteKeeper = window.RouteKeeper || {};

// OpenRouteServiceの徒歩経路、建物内通過、経由地をまとめて管理します。
RouteKeeper.routing = (function () {
  "use strict";

  var routeLayer = null;
  var destinationMarker = null;
  var activeRequest = null;
  var currentDestination = null;
  var routeWaypoints = [];
  var API_URL =
    "https://api.openrouteservice.org/v2/directions/foot-walking/geojson";

  function setStatus(message, type) {
    if (RouteKeeper.map && typeof RouteKeeper.map.setStatus === "function") {
      RouteKeeper.map.setStatus(message, type);
      return;
    }
    var status = document.getElementById("status-message");
    if (status) {
      status.textContent = message;
    }
  }

  function updateRouteInfo(distanceMeters, durationSeconds, routeMode) {
    var distanceElement = document.getElementById("route-distance");
    var durationElement = document.getElementById("route-duration");
    var routeModeElement = document.getElementById("route-mode");

    if (distanceElement) {
      distanceElement.textContent =
        distanceMeters == null ? "--" : formatDistance(distanceMeters);
    }
    if (durationElement) {
      durationElement.textContent =
        durationSeconds == null ? "--" : formatDuration(durationSeconds);
    }
    if (routeModeElement) {
      routeModeElement.textContent = routeMode || "--";
    }
  }

  function updateRouteControls() {
    var clearButton = document.getElementById("route-clear-button");
    if (clearButton) {
      clearButton.disabled = !currentDestination;
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

  function normalizeLatLng(value) {
    if (!value || !Number.isFinite(Number(value.lat)) || !Number.isFinite(Number(value.lng))) {
      return null;
    }
    return { lat: Number(value.lat), lng: Number(value.lng) };
  }

  function getConfiguredApiKey() {
    var configuredApiKey = window.ROUTEKEEPER_CONFIG && window.ROUTEKEEPER_CONFIG.ORS_API_KEY;
    return typeof configuredApiKey === "string" ? configuredApiKey.trim() : "";
  }

  async function fetchWalkingSegment(start, end, apiKey, signal) {
    var response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Accept: "application/geo+json, application/json",
        Authorization: apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        coordinates: [
          [Number(start.lng), Number(start.lat)],
          [Number(end.lng), Number(end.lat)]
        ]
      }),
      signal: signal
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("API_KEY_INVALID");
      }
      if (response.status === 404) {
        throw new Error("ROUTE_NOT_FOUND");
      }
      if (response.status === 429) {
        throw new Error("RATE_LIMIT_EXCEEDED");
      }
      throw new Error("API_ERROR_" + response.status);
    }

    var geojson = await response.json();
    var feature = geojson.features && geojson.features[0];
    var summary = feature && feature.properties && feature.properties.summary;
    if (!feature || !feature.geometry || !summary) {
      throw new Error("ROUTE_NOT_FOUND");
    }

    return {
      feature: feature,
      distance: Number(summary.distance) || 0,
      duration: Number(summary.duration) || 0
    };
  }

  function getBuildingCandidates() {
    var spots = RouteKeeper.storage && RouteKeeper.storage.loadSpots
      ? RouteKeeper.storage.loadSpots()
      : [];
    var groups = RouteKeeper.storage && RouteKeeper.storage.loadBuildingGroups
      ? RouteKeeper.storage.loadBuildingGroups()
      : [];
    var spotsById = {};
    var candidates = [];

    spots.forEach(function (spot) {
      spotsById[spot.id] = spot;
    });
    groups.forEach(function (group) {
      (Array.isArray(group.pairs) ? group.pairs : []).forEach(function (pair) {
        var entry = spotsById[pair.entrySpotId];
        var exit = spotsById[pair.exitSpotId];
        var durationMinutes = Number(pair.durationMinutes);
        if (
          entry && entry.type === "entry" &&
          exit && exit.type === "exit" &&
          Number.isFinite(durationMinutes) && durationMinutes > 0
        ) {
          candidates.push({
            groupName: group.name,
            entry: normalizeLatLng(entry),
            exit: normalizeLatLng(exit),
            durationSeconds: durationMinutes * 60
          });
        }
      });
    });
    return candidates.filter(function (candidate) {
      return candidate.entry && candidate.exit;
    });
  }

  function straightLineDistance(start, end) {
    var earthRadius = 6371000;
    var lat1 = start.lat * Math.PI / 180;
    var lat2 = end.lat * Math.PI / 180;
    var deltaLat = (end.lat - start.lat) * Math.PI / 180;
    var deltaLng = (end.lng - start.lng) * Math.PI / 180;
    var value = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  async function evaluateBuildingCandidate(candidate, start, destination, apiKey, signal) {
    try {
      var segments = await Promise.all([
        fetchWalkingSegment(start, candidate.entry, apiKey, signal),
        fetchWalkingSegment(candidate.exit, destination, apiKey, signal)
      ]);
      return {
        type: "building",
        groupName: candidate.groupName,
        entry: candidate.entry,
        exit: candidate.exit,
        startSegment: segments[0],
        endSegment: segments[1],
        duration: segments[0].duration + candidate.durationSeconds + segments[1].duration,
        distance: segments[0].distance + straightLineDistance(candidate.entry, candidate.exit) + segments[1].distance
      };
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }
      console.warn("建物経由候補を評価できませんでした:", candidate.groupName, error);
      return null;
    }
  }

  async function findBestLegRoute(start, destination, candidates, apiKey, signal) {
    var directSegment = await fetchWalkingSegment(start, destination, apiKey, signal);
    var bestRoute = {
      type: "direct",
      segment: directSegment,
      duration: directSegment.duration,
      distance: directSegment.distance
    };
    var evaluatedRoutes = await Promise.all(candidates.map(function (candidate) {
      return evaluateBuildingCandidate(candidate, start, destination, apiKey, signal);
    }));

    evaluatedRoutes.forEach(function (candidateRoute) {
      if (candidateRoute && candidateRoute.duration < bestRoute.duration) {
        bestRoute = candidateRoute;
      }
    });
    return bestRoute;
  }

  function routeLayersForLeg(route) {
    if (route.type === "direct") {
      return [L.geoJSON(route.segment.feature, {
        style: { color: "#1769d2", weight: 6, opacity: 0.85 }
      })];
    }

    return [
      L.geoJSON(route.startSegment.feature, {
        style: { color: "#1769d2", weight: 6, opacity: 0.85 }
      }),
      L.polyline(
        [[route.entry.lat, route.entry.lng], [route.exit.lat, route.exit.lng]],
        { color: "#7c3aed", weight: 6, opacity: 0.9, dashArray: "10 10" }
      ),
      L.geoJSON(route.endSegment.feature, {
        style: { color: "#1769d2", weight: 6, opacity: 0.85 }
      })
    ];
  }

  function renderRoutePlan(map, legs) {
    var layers = [];
    legs.forEach(function (leg) {
      layers = layers.concat(routeLayersForLeg(leg));
    });
    routeLayer = L.featureGroup(layers).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [40, 40], maxZoom: 16 });
  }

  function buildRouteMode(legs) {
    var buildingNames = [];
    legs.forEach(function (leg) {
      if (leg.type === "building" && buildingNames.indexOf(leg.groupName) === -1) {
        buildingNames.push(leg.groupName);
      }
    });
    var mode = buildingNames.length > 0
      ? buildingNames.join("・") + "経由"
      : "通常ルート";
    if (routeWaypoints.length > 0) {
      mode += "・経由地" + routeWaypoints.length + "件";
    }
    return mode;
  }

  async function calculateCurrentRoute() {
    var map = RouteKeeper.map && RouteKeeper.map.getMap();
    var apiKey = getConfiguredApiKey();
    var currentPosition = normalizeLatLng(RouteKeeper.state.currentPosition);

    if (!map) {
      setStatus("地図の初期化が完了していません。", "error");
      return false;
    }
    if (!currentDestination) {
      setStatus("目的地を先に指定してください。", "warning");
      return false;
    }
    if (!apiKey || apiKey === "YOUR_API_KEY" || apiKey === "REPLACE_ORS_API_KEY") {
      setStatus("警告：ルート検索を行うには、js/config.jsにOpenRouteService APIキーを設定してください。", "warning");
      return false;
    }
    if (!currentPosition) {
      setStatus("ルート検索を行うには、先に「現在地を表示」ボタンを押して現在地を取得してください。", "warning");
      return false;
    }

    clearRenderedRoute();
    var requestController = new AbortController();
    activeRequest = requestController;
    var routeTargets = routeWaypoints.map(function (waypoint) {
      return { lat: waypoint.lat, lng: waypoint.lng };
    }).concat([currentDestination]);
    var candidates = getBuildingCandidates();
    var legs = [];
    var legStart = currentPosition;
    setStatus("経由地を含むルートと建物経由ルートを比較しています…", "info");

    try {
      for (var index = 0; index < routeTargets.length; index += 1) {
        var leg = await findBestLegRoute(
          legStart,
          routeTargets[index],
          candidates,
          apiKey,
          requestController.signal
        );
        legs.push(leg);
        legStart = routeTargets[index];
      }

      var totalDistance = legs.reduce(function (sum, leg) { return sum + leg.distance; }, 0);
      var totalDuration = legs.reduce(function (sum, leg) { return sum + leg.duration; }, 0);
      var routeMode = buildRouteMode(legs);
      renderRoutePlan(map, legs);
      updateRouteInfo(totalDistance, totalDuration, routeMode);

      var buildingUsed = legs.some(function (leg) { return leg.type === "building"; });
      var message = routeWaypoints.length > 0
        ? "経由地" + routeWaypoints.length + "件を通るルートへ更新しました。"
        : "目的地までの徒歩ルートを表示しました。";
      if (buildingUsed) {
        message += " " + routeMode + "を利用します。紫の点線は建物内の移動です。";
      }
      setStatus(message, "success");
      return true;
    } catch (error) {
      if (error.name === "AbortError") {
        return false;
      }
      console.error("徒歩ルートの検索に失敗しました。", error);
      updateRouteInfo(null, null, null);

      if (error.message === "API_KEY_INVALID") {
        setStatus("エラー：OpenRouteService APIキーが無効か、利用資格がありません。js/config.jsの設定を確認してください。", "error");
      } else if (error.message === "ROUTE_NOT_FOUND") {
        setStatus("警告：指定した地点を通る徒歩ルートが見つかりませんでした。", "warning");
      } else if (error.message === "RATE_LIMIT_EXCEEDED") {
        setStatus("警告：APIの利用制限を超過しました。しばらく経ってから再試行してください。", "warning");
      } else {
        setStatus("エラー：徒歩ルートを取得できませんでした。APIキーや通信環境を確認してください。", "error");
      }
      return false;
    } finally {
      if (activeRequest === requestController) {
        activeRequest = null;
      }
    }
  }

  function searchWalkingRoute(destination) {
    var destinationLatLng = normalizeLatLng(destination);
    if (!destinationLatLng) {
      setStatus("目的地の座標が正しくありません。", "error");
      return Promise.resolve(false);
    }

    currentDestination = destinationLatLng;
    routeWaypoints = [];
    showDestination(destinationLatLng);
    updateRouteControls();
    return calculateCurrentRoute();
  }

  function addWaypoint(waypoint) {
    if (!currentDestination) {
      setStatus("先に目的地への経路を表示してから、経由地を追加してください。", "warning");
      return Promise.resolve(false);
    }

    var waypointLatLng = normalizeLatLng(waypoint);
    if (!waypointLatLng) {
      setStatus("経由地の座標が正しくありません。", "error");
      return Promise.resolve(false);
    }

    var waypointId = waypoint.id || "waypoint_" + waypointLatLng.lat + "_" + waypointLatLng.lng;
    var alreadyAdded = routeWaypoints.some(function (item) {
      return item.id === waypointId;
    });
    if (alreadyAdded) {
      setStatus("その経由地はすでに追加されています。", "warning");
      return Promise.resolve(false);
    }

    routeWaypoints.push({
      id: waypointId,
      label: waypoint.label || "経由地",
      lat: waypointLatLng.lat,
      lng: waypointLatLng.lng
    });
    updateRouteControls();
    return calculateCurrentRoute();
  }

  function showDestination(latlng) {
    var map = RouteKeeper.map && RouteKeeper.map.getMap();
    if (!map) {
      return;
    }
    if (destinationMarker) {
      destinationMarker.setLatLng(latlng);
    } else {
      destinationMarker = L.marker(latlng).bindPopup("目的地").addTo(map);
    }
  }

  function clearRenderedRoute() {
    var map = RouteKeeper.map && RouteKeeper.map.getMap();
    if (activeRequest) {
      activeRequest.abort();
      activeRequest = null;
    }
    if (map && routeLayer) {
      map.removeLayer(routeLayer);
    }
    routeLayer = null;
    updateRouteInfo(null, null, null);
  }

  function clearRoute() {
    var map = RouteKeeper.map && RouteKeeper.map.getMap();
    clearRenderedRoute();
    if (map && destinationMarker) {
      map.removeLayer(destinationMarker);
    }
    destinationMarker = null;
    currentDestination = null;
    routeWaypoints = [];
    updateRouteControls();
    setStatus("経路表示を終了しました。", "info");
  }

  function getRouteState() {
    return {
      destination: currentDestination && {
        lat: currentDestination.lat,
        lng: currentDestination.lng
      },
      waypoints: routeWaypoints.map(function (waypoint) {
        return Object.assign({}, waypoint);
      })
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    var clearButton = document.getElementById("route-clear-button");
    if (clearButton) {
      clearButton.addEventListener("click", clearRoute);
    }
    updateRouteControls();
  });

  return {
    searchWalkingRoute: searchWalkingRoute,
    addWaypoint: addWaypoint,
    clearRoute: clearRoute,
    getRouteState: getRouteState
  };
})();
