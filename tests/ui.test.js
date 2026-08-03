const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("登録種別と建物ペアUIを出入口・経由地の表現に統一する", function () {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /<option value="access">出入口 \(Access\)<\/option>/);
  assert.match(html, /<option value="way">経由地 \(Way\)<\/option>/);
  assert.doesNotMatch(html, /<option value="(?:entry|exit)">/);
  assert.match(html, /<label for="building-entry">出入口 A<\/label>/);
  assert.match(html, /<label for="building-exit">出入口 B<\/label>/);
});
