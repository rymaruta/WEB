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

## 2. 秘密の値の保管

`DATABASE_URL` と `CRON_SECRET` は、AWS Systems Manager Parameter Store に SecureString として保管します（`/zenbu-navi/DATABASE_URL`、`/zenbu-navi/CRON_SECRET`）。
任意で `/zenbu-navi/DATABASE_URL_UNPOOLED`（マイグレーション用の直接接続）と `/zenbu-navi/ANTHROPIC_API_KEY` も置けます。
デプロイ用ロールは `/zenbu-navi/*` だけを読めます。同じ名前の GitHub Secrets がある場合は、そちらを優先します。

ロールの ARN・公開 URL・RUM の ID・問い合わせ先は、`.github/workflows/deploy-aws.yml` に既定値があります。変える場合だけ、同じ名前の Variables を登録します。

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
