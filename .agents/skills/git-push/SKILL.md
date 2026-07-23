---
name: git-push
description: ユーザーから「pushして」「プッシュして」と指示された際に、変更内容からコミットメッセージを自動生成してmainブランチへadd, commit, pushを実行するスキル
---

# Git Push スキル

ユーザーから「pushして」「プッシュして」「コミットして」などの指示を受けた場合は、変更内容を確認して適切なコミットメッセージを生成し、以下の3ステップを実行します。

## 実行手順

1. git add .
2. git commit -m "変更内容のわかりやすい説明"
3. git push origin main
