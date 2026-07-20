window.RouteKeeper = window.RouteKeeper || {};

// 担当B：スポット登録、一覧表示、選択、削除を実装します。
RouteKeeper.spots = RouteKeeper.spots || {};

// タイプ値と日本語ラベルのマップ
const TYPE_LABELS = {
  entry: "入口",
  way: "経由地",
  exit: "出口"
};

/**
 * 保存済みスポット一覧をHTML（リスト形式）に描画・更新します。
 * @param {Array} [spots] - 描画するスポットの配列。省略された場合はLocalStorageからロードします。
 */
RouteKeeper.spots.renderSpotList = function (spots) {
  // 引数がない場合はLocalStorageからロード
  if (!spots) {
    spots = RouteKeeper.storage.loadSpots();
  }
  
  // 共通状態のspotsも同期
  RouteKeeper.state.spots = spots;

  const listContainer = document.getElementById("saved-spots-list");
  if (!listContainer) {
    return;
  }

  // コンテナをクリア
  listContainer.innerHTML = "";

  if (spots.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.className = "placeholder-text";
    placeholder.textContent = "保存されたスポットはありません。";
    listContainer.appendChild(placeholder);
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "spot-list";
  // spot-list のスタイル（css側で調整、またはデフォルトスタイル）
  ul.style.listStyle = "none";
  ul.style.padding = "0";
  ul.style.margin = "0";

  spots.forEach(function (spot) {
    const li = document.createElement("li");
    li.className = "spot-item";
    if (RouteKeeper.state.selectedSpotId === spot.id) {
      li.classList.add("active");
    }
    li.dataset.id = spot.id;
    
    // スタイル調整（必要であればcssに移動可能ですが、こちらで基本レイアウトを設定）
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    li.style.padding = "0.75rem";
    li.style.borderBottom = "1px solid #d3ddd7";
    li.style.cursor = "pointer";
    li.style.borderRadius = "0.25rem";
    li.style.marginBottom = "0.25rem";

    // テキスト部分（名前とタイプ）
    const infoDiv = document.createElement("div");
    infoDiv.className = "spot-info";

    const nameSpan = document.createElement("span");
    nameSpan.className = "spot-name-text";
    nameSpan.textContent = spot.name;
    nameSpan.style.fontWeight = "bold";

    const typeBadge = document.createElement("span");
    typeBadge.className = "spot-type-badge " + spot.type;
    typeBadge.textContent = TYPE_LABELS[spot.type] || spot.type;
    typeBadge.style.fontSize = "0.7rem";
    typeBadge.style.marginLeft = "0.5rem";
    typeBadge.style.padding = "0.15rem 0.4rem";
    typeBadge.style.borderRadius = "0.25rem";
    typeBadge.style.color = "#ffffff";
    
    // タイプ別のバッジカラー
    if (spot.type === "entry") {
      typeBadge.style.background = "#2e6f40"; // 緑系
    } else if (spot.type === "way") {
      typeBadge.style.background = "#e08b1b"; // オレンジ系
    } else {
      typeBadge.style.background = "#bd3a28"; // 赤系
    }

    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(typeBadge);

    // 削除ボタン
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = "削除";
    // 削除ボタンのスタイル
    deleteBtn.style.padding = "0.25rem 0.5rem";
    deleteBtn.style.fontSize = "0.8rem";
    deleteBtn.style.minHeight = "auto";
    deleteBtn.style.background = "#bd3a28";

    deleteBtn.addEventListener("click", function (event) {
      event.stopPropagation(); // liのクリックイベント発火を防ぐ
      if (confirm("スポット「" + spot.name + "」を削除しますか？")) {
        RouteKeeper.spots.deleteSpot(spot.id);
      }
    });

    li.appendChild(infoDiv);
    li.appendChild(deleteBtn);

    // クリックで選択状態にする
    li.addEventListener("click", function () {
      RouteKeeper.spots.selectSpot(spot.id);
    });

    ul.appendChild(li);
  });

  listContainer.appendChild(ul);
};

/**
 * 指定したIDのスポットを選択状態にします。
 * @param {string} id - スポットのID
 */
RouteKeeper.spots.selectSpot = function (id) {
  RouteKeeper.state.selectedSpotId = id;
  
  // リストの描画更新（activeクラスの付与のため）
  RouteKeeper.spots.renderSpotList();

  // マーカー選択やルート再計算などのために、他担当と連携するカスタムイベントを発行
  document.dispatchEvent(new CustomEvent("spotSelected", { detail: { id: id } }));
  
  const selectedSpot = RouteKeeper.state.spots.find(s => s.id === id);
  if (selectedSpot) {
    const statusMsg = document.getElementById("status-message");
    if (statusMsg) {
      statusMsg.textContent = "スポット「" + selectedSpot.name + "」が選択されました。";
    }
  }
};

/**
 * 指定したIDのスポットを削除し、再保存・再描画します。
 * @param {string} id - スポットのID
 */
RouteKeeper.spots.deleteSpot = function (id) {
  RouteKeeper.storage.deleteSpot(id);
  
  if (RouteKeeper.state.selectedSpotId === id) {
    RouteKeeper.state.selectedSpotId = null;
  }

  // 最新データをロードして描画
  const updatedSpots = RouteKeeper.storage.loadSpots();
  RouteKeeper.spots.renderSpotList(updatedSpots);

  // マーカー削除等のため、地図担当へ通知するカスタムイベントを発行
  document.dispatchEvent(new CustomEvent("spotsUpdated"));

  const statusMsg = document.getElementById("status-message");
  if (statusMsg) {
    statusMsg.textContent = "スポットを削除しました。";
  }
};

/**
 * スポット登録モードを開始します。
 */
RouteKeeper.spots.startRegistration = function () {
  RouteKeeper.state.mode = "register";

  const saveBtn = document.getElementById("spot-save-button");
  const statusMsg = document.getElementById("status-message");

  if (saveBtn && !RouteKeeper.state.draftSpot) {
    saveBtn.disabled = true; // 位置が指定されるまで保存不可
  }
  if (statusMsg) {
    statusMsg.textContent = "登録モード：地図上をクリックしてスポットの場所を指定してください。";
  }
};

/**
 * スポット登録モードをクリア（キャンセル）し、UIを初期状態に戻します。
 */
RouteKeeper.spots.cancelRegistration = function () {
  RouteKeeper.state.mode = "route";
  RouteKeeper.state.draftSpot = null;

  // UI要素のクリアとリセット
  const nameInput = document.getElementById("spot-name");
  const typeSelect = document.getElementById("spot-type");
  const saveBtn = document.getElementById("spot-save-button");
  const statusMsg = document.getElementById("status-message");

  if (nameInput) {
    nameInput.value = "";
  }
  if (typeSelect) {
    typeSelect.value = "entry";
  }
  if (saveBtn) {
    saveBtn.disabled = true;
  }
  if (statusMsg) {
    statusMsg.textContent = "入力をクリアしました。";
  }
  
  // 地図上にドラフト表示されているマーカーがあれば消去させるため、イベントを発行
  document.dispatchEvent(new CustomEvent("registrationCancelled"));
};

/**
 * 地図クリックイベントを処理します。（地図担当から呼び出されるか、イベント経由で実行）
 * @param {Object} latlng - L.LatLngオブジェクト相当（{lat, lng}）
 */
RouteKeeper.spots.handleMapClick = function (latlng) {
  // 自動で登録モードに入る
  if (RouteKeeper.state.mode !== "register") {
    RouteKeeper.spots.startRegistration();
  }

  RouteKeeper.state.draftSpot = {
    lat: latlng.lat,
    lng: latlng.lng
  };

  // 保存ボタンを活性化
  const saveBtn = document.getElementById("spot-save-button");
  if (saveBtn) {
    saveBtn.disabled = false;
  }

  const statusMsg = document.getElementById("status-message");
  if (statusMsg) {
    statusMsg.textContent = "位置が指定されました。スポット名を入力して「保存」を押してください。(" + latlng.lat.toFixed(5) + ", " + latlng.lng.toFixed(5) + ")";
  }

  // 地図上にドラフトピンを立てるため、イベントを発行
  document.dispatchEvent(new CustomEvent("draftSpotPositioned", { detail: latlng }));
};

/**
 * 入力内容を元にスポットを確定し、保存します。
 */
RouteKeeper.spots.saveDraftSpot = function () {
  const nameInput = document.getElementById("spot-name");
  const typeSelect = document.getElementById("spot-type");
  
  const name = nameInput ? nameInput.value.trim() : "";
  if (!name) {
    alert("スポット名を入力してください。");
    if (nameInput) nameInput.focus();
    return;
  }

  if (!RouteKeeper.state.draftSpot) {
    alert("地図上をクリックして位置を指定してください。");
    return;
  }

  const type = typeSelect ? typeSelect.value : "entry";
  const newSpot = {
    id: "spot_" + Date.now(),
    name: name,
    type: type,
    lat: RouteKeeper.state.draftSpot.lat,
    lng: RouteKeeper.state.draftSpot.lng
  };

  // 保存
  RouteKeeper.storage.addSpot(newSpot);

  // 登録モードを抜ける (入力をクリア)
  RouteKeeper.spots.cancelRegistration();

  // 再描画
  RouteKeeper.spots.renderSpotList();

  // マーカー更新のため地図担当へ通知
  document.dispatchEvent(new CustomEvent("spotsUpdated"));

  const statusMsg = document.getElementById("status-message");
  if (statusMsg) {
    statusMsg.textContent = "スポット「" + name + "」を保存しました。";
  }
};

// 独自でイベントリスナーをバインド
document.addEventListener("DOMContentLoaded", function () {
  const cancelBtn = document.getElementById("spot-cancel-button");
  const saveBtn = document.getElementById("spot-save-button");
  const nameInput = document.getElementById("spot-name");
  const apiKeyInput = document.getElementById("api-key");

  if (cancelBtn) {
    cancelBtn.addEventListener("click", function () {
      RouteKeeper.spots.cancelRegistration();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      RouteKeeper.spots.saveDraftSpot();
    });
  }

  // スポット名入力時に自動で登録モードを開始
  if (nameInput) {
    nameInput.addEventListener("focus", function () {
      if (RouteKeeper.state.mode !== "register") {
        RouteKeeper.spots.startRegistration();
      }
    });
    nameInput.addEventListener("input", function () {
      if (RouteKeeper.state.mode !== "register") {
        RouteKeeper.spots.startRegistration();
      }
    });
  }

  // APIキーの初期ロードとイベント登録
  if (apiKeyInput) {
    const savedKey = RouteKeeper.storage.loadApiKey();
    apiKeyInput.value = savedKey;
    
    // グローバルオブジェクトに即時適用
    window.ROUTEKEEPER_CONFIG = window.ROUTEKEEPER_CONFIG || {};
    window.ROUTEKEEPER_CONFIG.ORS_API_KEY = savedKey;

    apiKeyInput.addEventListener("input", function () {
      const key = apiKeyInput.value.trim();
      RouteKeeper.storage.saveApiKey(key);
      window.ROUTEKEEPER_CONFIG.ORS_API_KEY = key;
    });
  }

  // 担当Bデバッグ用：地図が未実装の間、#map領域をクリックすることで位置登録をシミュレートします
  const mapElement = document.getElementById("map");
  if (mapElement) {
    mapElement.style.cursor = "pointer"; // クリック可能であることを示す
    mapElement.addEventListener("click", function () {
      // 地図クリックで自動的に登録モードに入る
      RouteKeeper.spots.handleMapClick({ lat: 35.68123, lng: 139.76712 });
    });
  }
});

