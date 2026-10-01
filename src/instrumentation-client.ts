/**
 * アクセス解析（Amazon CloudWatch RUM）。ページビューとセッションのみを記録し、Cookie は使わない。
 * 送信はアプリモニターのリソースベースポリシーで許可する（署名・Cognito なし）。
 * 軽量版の Web クライアント（cwr-slim.js、約10KB）を公式 CDN から非同期に読み込む。
 * NEXT_PUBLIC_RUM_APP_MONITOR_ID が未設定の環境では何もしない。
 */
const appMonitorId = process.env.NEXT_PUBLIC_RUM_APP_MONITOR_ID;
const region = process.env.NEXT_PUBLIC_RUM_REGION ?? "ap-northeast-1";

declare global {
  interface Window {
    AwsRumClient?: unknown;
    cwr?: (command: string, payload?: unknown) => void;
  }
}

if (appMonitorId) {
  try {
    // 公式の CDN 用スニペットと同じ初期化（https://github.com/aws-observability/aws-rum-web/blob/main/docs/cdn_installation.md）
    const queue: { c: string; p: unknown }[] = [];
    window.AwsRumClient = {
      q: queue,
      n: "cwr",
      i: appMonitorId,
      v: "1.0.0",
      r: region,
      c: {
        endpoint: `https://dataplane.rum.${region}.amazonaws.com`,
        sessionSampleRate: 1,
        allowCookies: false,
      },
    };
    window.cwr = (c, p) => {
      queue.push({ c, p });
    };
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://client.rum.us-east-1.amazonaws.com/3.x/cwr-slim.js";
    document.head.appendChild(script);
  } catch {
    // 解析の失敗はサイトの動作に影響させない
  }
}

export {};
