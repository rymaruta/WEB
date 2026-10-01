# 公開手順（AWS ＋ Neon）

Vercel から AWS へ移行するための手順です。データベースは引き続き **Neon** を使います。

## 構成

| 役割 | サービス |
| --- | --- |
| サイトの実行 | Amazon Lightsail のコンテナサービス（東京、1台） |
| デプロイ | GitHub Actions（`.github/workflows/deploy-aws.yml`）。main への push で自動実行 |
| 定期収集 | GitHub Actions（`.github/workflows/crawl.yml`）から `/api/cron/crawl` を15分ごとに呼び出す |
| アクセス解析 | Amazon CloudWatch RUM（ページビューとセッションのみ、Cookie 不使用） |
| ドメイン・DNS | Amazon Route 53 |

- Next.js は `output: "standalone"` でビルドし、`node server.js` を1台で動かします。ISR とページの再生成は、このサーバーのキャッシュで完結します。
- Lightsail は約60秒で応答を打ち切るため、`/api/cron/crawl` は受け付けた時点で 202 を返し、収集は応答後に `after()` で行います。収集結果は Lightsail のログに `{"event":"crawl", ...}` の形で出力されます。
- ビルドにはデータベースへの接続が必要なため、`next build` は GitHub Actions 上で行い、出来上がった `.next/standalone` を Docker イメージに詰めます（`Dockerfile`）。

## 1. AWS の準備

すべて東京リージョン（`ap-northeast-1`）に作ります。名前は `zenbu-navi` で始め、タグ `Project=zenbu-navi` を付けます。

1. **Lightsail のコンテナサービス**：名前 `zenbu-navi`、規模は Micro、台数は1。
2. **デプロイ用 IAM ロール**：GitHub の OIDC（`token.actions.githubusercontent.com`）で、このリポジトリの main ブランチからだけ引き受けられるようにします。権限は、このコンテナサービスへのイメージ登録とデプロイに限ります。
3. **CloudWatch RUM のアプリモニター**（任意）：ドメインに公開 URL を登録し、リソースベースポリシーで送信を許可します（Cognito は使いません）。

## 2. GitHub の設定

リポジトリの **Settings → Secrets and variables → Actions** に登録します。

| 種類 | 名前 | 値 |
| --- | --- | --- |
| Variable | `AWS_DEPLOY_ROLE_ARN` | 手順1-2のロールの ARN |
| Variable | `NEXT_PUBLIC_SITE_URL` | 公開 URL（独自ドメインの設定前は Lightsail の URL） |
| Variable | `CONTACT_EMAIL` | 問い合わせ先 |
| Variable | `NEXT_PUBLIC_RUM_APP_MONITOR_ID` | 手順1-3のアプリモニター ID（任意） |
| Secret | `DATABASE_URL` | Neon の接続文字列（Vercel の環境変数と同じ値） |
| Secret | `DATABASE_URL_UNPOOLED` | Neon の直接接続の文字列（任意。Vercel の環境変数と同じ値） |
| Secret | `CRON_SECRET` | Vercel の環境変数と同じ値 |
| Secret | `ANTHROPIC_API_KEY` | API でまとめ記事を作る場合のみ |

Vercel の環境変数の値は、Vercel のプロジェクトの **Settings → Environment Variables** で確認できます。

`AWS_DEPLOY_ROLE_ARN` を登録するまでは、デプロイのワークフローは何もせずに終了します。

## 3. 初回デプロイと確認

1. **Actions** タブで **Deploy to AWS** を選び、**Run workflow** を押します。
2. 最後のステップに表示される URL を開き、トップ・ジャンル・トピック・検索・ランキングが表示されることを確認します。
3. 収集の確認：Actions の **Crawl news** は、シークレット `SITE_URL` の URL を呼び出します。確認できたら `SITE_URL` を AWS の URL に変更し、**Run workflow** で1回実行して、Lightsail のログに収集結果が出ることを確認します。

## 4. ドメイン

独自ドメインを Route 53 のホストゾーンで管理し、Lightsail のコンテナサービスにカスタムドメインと証明書を設定します。
設定後、変数 `NEXT_PUBLIC_SITE_URL` とシークレット `SITE_URL` を独自ドメインの URL に変更し、もう一度デプロイします。

## 5. Vercel の停止

AWS で表示・収集・まとめ記事がすべて動くことを確認してから停止します。
移行期間中は Vercel も main からデプロイされ続けるため、`vercel.json` と `package.json` の `vercel-build` は停止まで残しておきます。
