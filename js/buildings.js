window.RouteKeeper = window.RouteKeeper || {};

RouteKeeper.buildings = (function () {
  "use strict";

  function getElement(id) {
    return document.getElementById(id);
  }

  function setStatus(message, type) {
    if (RouteKeeper.map && typeof RouteKeeper.map.setStatus === "function") {
      RouteKeeper.map.setStatus(message, type);
    }
  }

  function createOption(value, label) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function fillSpotSelect(select, spots, emptyLabel) {
    if (!select) {
      return;
    }
    var previousValue = select.value;
    select.replaceChildren(createOption("", emptyLabel));
    spots.forEach(function (spot) {
      select.appendChild(createOption(spot.id, spot.name));
    });
    if (spots.some(function (spot) { return spot.id === previousValue; })) {
      select.value = previousValue;
    }
    select.disabled = spots.length === 0;
  }

  function findSpot(spots, id) {
    return spots.find(function (spot) {
      return spot.id === id;
    });
  }

  function render() {
    var spots = RouteKeeper.storage.loadSpots();
    var groups = RouteKeeper.storage.loadBuildingGroups();
    RouteKeeper.state.buildingGroups = groups;

    fillSpotSelect(
      getElement("building-entry"),
      spots.filter(function (spot) { return spot.type === "entry"; }),
      "入口を選択"
    );
    fillSpotSelect(
      getElement("building-exit"),
      spots.filter(function (spot) { return spot.type === "exit"; }),
      "出口を選択"
    );

    var nameOptions = getElement("building-name-options");
    if (nameOptions) {
      nameOptions.replaceChildren();
      groups.forEach(function (group) {
        nameOptions.appendChild(createOption(group.name, group.name));
      });
    }

    renderGroupList(groups, spots);
  }

  function renderGroupList(groups, spots) {
    var container = getElement("building-groups-list");
    if (!container) {
      return;
    }
    container.replaceChildren();

    if (groups.length === 0) {
      var placeholder = document.createElement("p");
      placeholder.className = "placeholder-text building-placeholder";
      placeholder.textContent = "建物の入口・出口ペアはまだありません。";
      container.appendChild(placeholder);
      return;
    }

    groups.forEach(function (group) {
      var section = document.createElement("section");
      section.className = "building-group-card";

      var heading = document.createElement("h3");
      heading.textContent = group.name;
      section.appendChild(heading);

      (Array.isArray(group.pairs) ? group.pairs : []).forEach(function (pair) {
        var entry = findSpot(spots, pair.entrySpotId);
        var exit = findSpot(spots, pair.exitSpotId);
        if (!entry || !exit) {
          return;
        }

        var row = document.createElement("div");
        row.className = "building-pair-row";

        var description = document.createElement("span");
        description.textContent = entry.name + " → " + exit.name + "（" + pair.durationMinutes + "分）";

        var deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "btn-delete building-pair-delete";
        deleteButton.textContent = "削除";
        deleteButton.addEventListener("click", function () {
          deletePair(group.id, pair.id);
        });

        row.appendChild(description);
        row.appendChild(deleteButton);
        section.appendChild(row);
      });

      container.appendChild(section);
    });
  }

  function savePair() {
    var nameInput = getElement("building-name");
    var entrySelect = getElement("building-entry");
    var exitSelect = getElement("building-exit");
    var durationInput = getElement("building-duration");

    var buildingName = nameInput ? nameInput.value.trim() : "";
    var entrySpotId = entrySelect ? entrySelect.value : "";
    var exitSpotId = exitSelect ? exitSelect.value : "";
    var durationMinutes = durationInput ? Number(durationInput.value) : NaN;
    var spots = RouteKeeper.storage.loadSpots();
    var entrySpot = findSpot(spots, entrySpotId);
    var exitSpot = findSpot(spots, exitSpotId);

    if (!buildingName) {
      setStatus("建物名を入力してください。", "warning");
      if (nameInput) nameInput.focus();
      return;
    }
    if (!entrySpot || entrySpot.type !== "entry") {
      setStatus("建物の入口を選択してください。", "warning");
      return;
    }
    if (!exitSpot || exitSpot.type !== "exit") {
      setStatus("建物の出口を選択してください。", "warning");
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setStatus("建物内の徒歩時間を0より大きい分数で入力してください。", "warning");
      if (durationInput) durationInput.focus();
      return;
    }

    var groups = RouteKeeper.storage.loadBuildingGroups();
    var normalizedName = buildingName.toLocaleLowerCase("ja");
    var group = groups.find(function (candidate) {
      return String(candidate.name || "").trim().toLocaleLowerCase("ja") === normalizedName;
    });

    if (!group) {
      group = {
        id: "building_" + Date.now(),
        name: buildingName,
        pairs: []
      };
      groups.push(group);
    }

    var existingPair = group.pairs.find(function (pair) {
      return pair.entrySpotId === entrySpotId && pair.exitSpotId === exitSpotId;
    });
    if (existingPair) {
      existingPair.durationMinutes = durationMinutes;
    } else {
      group.pairs.push({
        id: "pair_" + Date.now(),
        entrySpotId: entrySpotId,
        exitSpotId: exitSpotId,
        durationMinutes: durationMinutes
      });
    }

    RouteKeeper.storage.saveBuildingGroups(groups);
    RouteKeeper.state.buildingGroups = groups;
    if (entrySelect) entrySelect.value = "";
    if (exitSelect) exitSelect.value = "";
    if (durationInput) durationInput.value = "";
    render();
    document.dispatchEvent(new CustomEvent("buildingGroupsUpdated"));
    setStatus("建物「" + group.name + "」の入口・出口ペアを保存しました。", "success");
  }

  function deletePair(groupId, pairId) {
    var groups = RouteKeeper.storage.loadBuildingGroups();
    var updatedGroups = groups.map(function (group) {
      if (group.id !== groupId) {
        return group;
      }
      return Object.assign({}, group, {
        pairs: (Array.isArray(group.pairs) ? group.pairs : []).filter(function (pair) {
          return pair.id !== pairId;
        })
      });
    }).filter(function (group) {
      return group.pairs.length > 0;
    });

    RouteKeeper.storage.saveBuildingGroups(updatedGroups);
    RouteKeeper.state.buildingGroups = updatedGroups;
    render();
    document.dispatchEvent(new CustomEvent("buildingGroupsUpdated"));
    setStatus("建物の入口・出口ペアを削除しました。", "success");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var saveButton = getElement("building-pair-save-button");
    if (saveButton) {
      saveButton.addEventListener("click", savePair);
    }
    document.addEventListener("spotsUpdated", render);
    document.addEventListener("buildingGroupsUpdated", render);
  });

  return {
    render: render,
    savePair: savePair,
    deletePair: deletePair
  };
})();
