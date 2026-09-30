# 公開手順（Vercel ＋ Neon）

所要時間は15分ほどです。サイトの置き場所に **Vercel**、ニュースを保存するデータベースに **Neon** を使います。どちらも無料枠で始められます。

> **費用について**
> Vercel の無料プラン（Hobby）は個人・非商用向けです。広告やアフィリエイトで収益化する場合は、有料プラン（Pro）に切り替えてください。Neon は無料枠の容量（0.5GB）で当面は足ります。

## 事前準備：コードを main に取り込む

GitHub のプルリクエスト「Add all-genre news portal」を開き、**Merge pull request** を押します。
公開と定期収集は main ブランチの内容で動きます。

## 1. Vercel にプロジェクトを作る

1. https://vercel.com/signup を開き、**Continue with GitHub** で登録します。
2. ダッシュボードで **Add New… → Project** を押します。
3. 一覧から `WEB` リポジトリを選び、**Import** を押します。
4. **Environment Variables** を開いて、次の2つを追加します。

   | Name | Value |
   | --- | --- |
   | `CRON_SECRET` | 推測されにくい長い文字列（パスワード生成ツールで32文字以上） |
   | `CONTACT_EMAIL` | お問い合わせ用のメールアドレス |

5. **Deploy** を押します。この時点ではデータベースがないため**失敗しますが、問題ありません**。

## 2. データベース（Neon）をつなぐ

1. Vercel のプロジェクト画面で **Storage** タブを開きます。
2. **Create Database** から **Neon（Serverless Postgres）** を選びます。
3. リージョンは **Asia Pacific (Tokyo)** を選びます（サーバーを東京に置く設定と合わせるため）。
4. 作成後、プロジェクトに接続（Connect）します。`DATABASE_URL` などの接続情報は自動で設定されます。
5. **Deployments** タブで最新のデプロイの「…」から **Redeploy** を押します。

完了すると `https://<プロジェクト名>.vercel.app` でサイトが表示されます。
この時点ではニュースがまだ空なので、「ニュースを準備しています」と表示されます。

## 3. ニュースの自動収集を設定する

GitHub のリポジトリで **Settings → Secrets and variables → Actions → New repository secret** を開き、次の1つを登録します。

| Name | Value |
| --- | --- |
| `CRON_SECRET` | 手順1で Vercel に入れたものと**同じ値** |

収集先のサイト URL（`https://zenbunavi.com`）はワークフローに設定済みです。ドメインを変更した場合は、`.github/workflows/crawl.yml` の既定値を変えるか、`SITE_URL` という名前のシークレットで新しい URL を登録してください。

登録したら、すぐに1回目の収集を実行します。

1. リポジトリの **Actions** タブを開きます。
2. 左の一覧から **Crawl news** を選び、**Run workflow** を押します。
3. 1分ほどでサイトにニュースが表示されます。

以降は15分ごとに自動で収集します（GitHub の混雑状況によっては数分遅れることがあります）。

## 4. AI まとめ記事を有効にする（任意）

方法は2つあります。**追加料金をかけたくない場合は A** を使います。

### A. Claude Code の定期実行で書く（Claude の有料プランの範囲内・追加料金なし）

Claude Code のルーティン（定期実行）が、`GET /api/admin/articles/pending` で書くべき話題と材料・執筆ルールを受け取り、記事を書いて `POST /api/admin/articles/{id}` に投稿します。
どちらの窓口も `Authorization: Bearer $CRON_SECRET` が必要です。投稿された記事は、自動作成と同じ検証（出典番号の範囲チェックなど）を通ってから保存されます。
ルーティンは Claude Code から作成・停止できます（claude.ai/code のルーティン一覧）。Claude の利用上限の範囲で動作します。

### B. Anthropic API で自動作成する（API 利用料がかかる）


大きな話題（3媒体以上が報道）について、AI が出典付きのまとめ記事を自動で書くようになります。

1. https://console.anthropic.com/ に登録し、**Billing** で支払い方法を登録してクレジットを購入します。
2. **API Keys** で **Create Key** を押し、表示されたキー（`sk-ant-` で始まる文字列）をコピーします。
3. Vercel のプロジェクトで **Settings → Environment Variables** を開き、`ANTHROPIC_API_KEY` という名前でキーを登録します。
4. **Deployments** から最新のデプロイを **Redeploy** します。

以降は15分ごとの収集のたびに、最大5本ずつまとめ記事が作成されます。

**費用の目安**（2026年9月時点の料金、1日あたり約60本の作成を想定）

| モデル | 1本あたり | 1か月 |
| --- | --- | --- |
| Claude Opus 5.5（既定） | 約5円 | 約9,000円 |
| Claude Sonnet 5.5 | 約2.5円 | 約4,500円 |

費用を抑える場合は、Vercel の環境変数 `AI_MODEL` に `claude-sonnet-5-5` を設定してください。Anthropic Console の **Limits** で月の上限額を設定しておくと、想定外の請求を防げます。

## 公開後に確認すること

- [ ] トップページにニュースが表示される
- [ ] 「掲載メディア」ページで、各メディアの最終取得時刻が更新されている
- [ ] 運営方針ページのお問い合わせ先が、自分のメールアドレスになっている
- [ ] 商用利用の前に、各メディアの RSS 利用規約を確認した

## 独自ドメインを使う場合

Vercel の **Settings → Domains** でドメインを追加し、表示される DNS 設定をドメイン管理会社で行います。
その後、Vercel の環境変数に `NEXT_PUBLIC_SITE_URL=https://独自ドメイン` を追加して Redeploy し、GitHub の `SITE_URL` も新しい URL に変更してください。

## うまくいかないとき

| 症状 | 確認すること |
| --- | --- |
| デプロイが `Can't reach database server` で失敗する | 手順2でデータベースをプロジェクトに接続したか。接続後に Redeploy したか |
| Actions の Crawl news が 401 で失敗する | GitHub と Vercel の `CRON_SECRET` が完全に同じ値か。Vercel 側を変えた後に Redeploy したか |
| Actions は成功するがニュースが増えない | 同じフィードは10分以内に再取得しない仕様です。15分後に再確認してください |
