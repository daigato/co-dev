window.RouteKeeper = window.RouteKeeper || {};

// 担当A：Leaflet地図、現在地、スポット地点の表示を管理します。
RouteKeeper.map = (function () {
  "use strict";

  var map = null;
  var currentPositionMarker = null;
  var spotNodeLayer = null;
  var spotsLayer = null;
  var draftMarker = null;
  var spotMarkersMap = {}; // spot id -> L.Marker
  var userInteractedAfterGeoRequest = false; // geolocation要求後のユーザー操作フラグ
  var mapWasDragged = false; // ドラッグ直後の誤click発火防止フラグ
  var dragEndTime = 0;       // ドラッグ終了時刻

  var DEFAULT_CENTER = [36.2048, 138.2529]; // 日本全体を中心
  var DEFAULT_ZOOM = 6;

  var TYPE_LABELS = {
    entry: "入口",
    way: "経由地",
    exit: "出口"
  };

  /**
   * ステータスメッセージとデザイン状態（error / warning / success / info）の更新
   */
  function setStatus(message, type) {
    var status = document.getElementById("status-message");
    if (!status) return;

    status.textContent = message;
    status.classList.remove("error", "warning", "success", "info");
    if (type) {
      status.classList.add(type);
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
      setStatus("地図ライブラリを読み込めませんでした。通信環境を確認してください。", "error");
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
    spotsLayer = L.layerGroup().addTo(map);

    map.on("dragstart", function () {
      mapWasDragged = true;
    });
    map.on("dragend", function () {
      dragEndTime = Date.now();
    });

    map.on("click", handleMapClick);

    setTimeout(function () {
      if (map) {
        map.invalidateSize();
      }
    }, 100);

    window.addEventListener("resize", function () {
      if (map) {
        map.invalidateSize();
      }
    });

    // イベントリスナーの登録
    document.addEventListener("spotsUpdated", function () {
      renderSpotMarkers();
    });

    document.addEventListener("draftSpotPositioned", function (e) {
      if (e.detail) {
        showDraftMarker(e.detail);
      }
    });

    document.addEventListener("registrationCancelled", function () {
      clearDraftMarker();
    });

    document.addEventListener("spotSelected", function (e) {
      if (e.detail && e.detail.id) {
        focusSpotMarker(e.detail.id);
      }
    });

    // サイドバー切り替えボタンの登録
    var toggleBtn = document.getElementById("sidebar-toggle-button");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        var sidebar = document.querySelector(".sidebar");
        if (sidebar) {
          sidebar.classList.toggle("collapsed");
          setTimeout(function () {
            if (map) map.invalidateSize();
          }, 300);
        }
      });
    }

    var currentLocationButton = document.getElementById("current-location-button");
    if (currentLocationButton) {
      currentLocationButton.addEventListener("click", function () {
        // geolocation要求前に操作フラグをリセット
        userInteractedAfterGeoRequest = false;
        getCurrentPosition({ moveMap: true }).catch(function () {
          // エラーメッセージは getCurrentPosition 内で表示
        });
      });
    }

    // 地図操作（クリック・ドラッグ・ズーム）でフラグをセット
    map.on("mousedown", function () {
      userInteractedAfterGeoRequest = true;
    });
    map.on("dragstart", function () {
      userInteractedAfterGeoRequest = true;
    });
    map.on("zoomstart", function () {
      userInteractedAfterGeoRequest = true;
    });

    // 保存済みスポットの初回レンダリング
    renderSpotMarkers();

    setStatus("地図を読み込みました。地図をクリックするかスポットを選択してください。", "success");
    return map;
  }

  function createCustomIcon(type, isDraft) {
    var iconClass = "spot-pin-" + (isDraft ? "draft" : (type || "entry"));
    var symbol = isDraft ? "★" : (type === "entry" ? "入" : type === "exit" ? "出" : "経");

    return L.divIcon({
      className: "custom-spot-marker-container",
      html: '<div class="custom-spot-pin ' + iconClass + '"><span>' + symbol + '</span></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30]
    });
  }

  /**
   * 保存済みスポット一覧の全マーカーを地図上に再描画する（削除・追加時のリアルタイム同期）
   */
  function renderSpotMarkers() {
    if (!map || !spotsLayer) return;

    spotsLayer.clearLayers();
    spotMarkersMap = {};

    var spots = (RouteKeeper.storage && typeof RouteKeeper.storage.loadSpots === "function")
      ? RouteKeeper.storage.loadSpots()
      : (RouteKeeper.state.spots || []);

    spots.forEach(function (spot) {
      if (!spot || !Number.isFinite(Number(spot.lat)) || !Number.isFinite(Number(spot.lng))) {
        return;
      }

      var icon = createCustomIcon(spot.type, false);
      var marker = L.marker([Number(spot.lat), Number(spot.lng)], { icon: icon });

      // ポップアップの設定
      var typeLabel = TYPE_LABELS[spot.type] || spot.type;
      var popupContent = document.createElement("div");
      popupContent.className = "spot-popup";
      popupContent.innerHTML = 
        '<div class="spot-popup-header">' +
          '<strong class="spot-popup-title">' + escapeHtml(spot.name) + '</strong>' +
          '<span class="spot-type-badge ' + escapeHtml(spot.type) + '" style="font-size:0.7rem; padding:2px 6px; border-radius:4px; color:#fff; background:' + (spot.type==='entry'?'#2e6f40':spot.type==='way'?'#e08b1b':'#bd3a28') + ';">' + escapeHtml(typeLabel) + '</span>' +
        '</div>' +
        '<div class="spot-popup-actions">' +
          '<button type="button" class="spot-popup-btn spot-popup-btn-route">ここへ徒歩ルートを検索</button>' +
          '<button type="button" class="spot-popup-btn spot-popup-btn-delete">このスポットを削除</button>' +
        '</div>';

      // ボタンのイベントリスナー
      var routeBtn = popupContent.querySelector(".spot-popup-btn-route");
      if (routeBtn) {
        routeBtn.addEventListener("click", function () {
          if (RouteKeeper.routing && typeof RouteKeeper.routing.searchWalkingRoute === "function") {
            RouteKeeper.routing.searchWalkingRoute({ lat: spot.lat, lng: spot.lng });
          }
        });
      }

      var deleteBtn = popupContent.querySelector(".spot-popup-btn-delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", function () {
          if (confirm("スポット「" + spot.name + "」を削除しますか？")) {
            if (RouteKeeper.spots && typeof RouteKeeper.spots.deleteSpot === "function") {
              RouteKeeper.spots.deleteSpot(spot.id);
            }
          }
        });
      }

      marker.bindPopup(popupContent);

      marker.on("click", function () {
        if (RouteKeeper.spots && typeof RouteKeeper.spots.selectSpot === "function") {
          RouteKeeper.spots.selectSpot(spot.id);
        }
      });

      marker.addTo(spotsLayer);
      spotMarkersMap[spot.id] = marker;
    });
  }

  function showDraftMarker(latlng) {
    if (!map) return;
    clearDraftMarker();

    var icon = createCustomIcon("draft", true);
    draftMarker = L.marker([latlng.lat, latlng.lng], { icon: icon })
      .bindPopup("新規登録位置")
      .addTo(map);
    draftMarker.openPopup();
  }

  function clearDraftMarker() {
    if (map && draftMarker) {
      map.removeLayer(draftMarker);
      draftMarker = null;
    }
  }

  function focusSpotMarker(id) {
    var marker = spotMarkersMap[id];
    if (marker && map) {
      // setView は呼ばない（リスト選択で地図が強制移動しないように）
      marker.openPopup();
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function handleMapClick(event) {
    // ドラッグ終了後300ms以内のclickは誤発火として無視
    if (Date.now() - dragEndTime < 300) {
      return;
    }
    if (RouteKeeper.spots && typeof RouteKeeper.spots.handleMapClick === "function") {
      RouteKeeper.spots.handleMapClick(event.latlng);
    }
  }

  function getMap() {
    return map;
  }

  function getCurrentPosition(options) {
    var settings = options || {};

    if (!navigator.geolocation) {
      setStatus("このブラウザは現在地取得に対応していません。", "error");
      return Promise.reject(new Error("Geolocation is not supported."));
    }

    setStatus("現在地を取得しています…", "info");

    return new Promise(function (resolve, reject) {
      navigator.geolocation.getCurrentPosition(
        function (position) {
          var latlng = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          RouteKeeper.state.currentPosition = latlng;
          showCurrentPosition(latlng);

          // カメラ移動：ユーザーが現在地ボタン押下後に地図を触っていない場合のみ移動
          if (settings.moveMap !== false && map && !userInteractedAfterGeoRequest) {
            map.setView([latlng.lat, latlng.lng], 16);
            setStatus("現在地を表示しました。ピンをドラッグして現在地を変更できます。", "success");
          } else {
            setStatus("現在地を取得しました。現在地ピンをドラッグして位置を調整できます。", "info");
          }
          resolve(latlng);
        },
        function (error) {
          var messages = {
            1: "現在地の利用が許可されていません。ブラウザの位置情報許可設定を確認してください。",
            2: "現在地を取得できませんでした。電波状況や位置情報設定を確認してください。",
            3: "現在地の取得がタイムアウトしました。もう一度お試しください。"
          };
          setStatus(messages[error.code] || "現在地を取得できませんでした。", "error");
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

    var icon = L.divIcon({
      className: "custom-current-location-marker",
      html: '<div style="background:#2878d0; width:16px; height:16px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:move;"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    currentPositionMarker = L.marker(latlng, { icon: icon, draggable: true })
      .bindPopup("現在地（ドラッグで移動可能）")
      .addTo(map);

    currentPositionMarker.on("dragend", function (event) {
      var newPos = event.target.getLatLng();
      RouteKeeper.state.currentPosition = { lat: newPos.lat, lng: newPos.lng };
      setStatus("現在地の位置を手動で変更しました。(" + newPos.lat.toFixed(4) + ", " + newPos.lng.toFixed(4) + ")", "info");
    });
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
    clearSpotNodes: clearSpotNodes,
    renderSpotMarkers: renderSpotMarkers,
    setStatus: setStatus
  };
})();
