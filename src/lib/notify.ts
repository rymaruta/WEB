import { AwsClient } from "aws4fetch";

const REGION = "ap-northeast-1";
const FROM = "ぜんぶナビ <alerts@zenbu-navi.com>";
const ADMIN_URL = "https://zenbu-navi.com/admin";

/** 運営者への通知の中身。件名は短く、本文は「何が起きたか」「どうすればよいか」「詳細」に分ける */
export type Notice = {
  /** 件名（例: 夜のニュースを見送りました） */
  title: string;
  /** 何が起きたか（1〜2文） */
  what: string;
  /** どうすればよいか（任意） */
  action?: string;
  /** エラーの内容など（任意。本文の最後に小さく出す） */
  detail?: string;
};

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** プレーンテキスト版（HTML を表示しないメールアプリ向け） */
export function noticeText(n: Notice): string {
  return [n.what, n.action ? `\n対応：${n.action}` : "", `\n管理画面：${ADMIN_URL}`, n.detail ? `\n---\n${n.detail}` : ""].join("\n").trim();
}

/** HTML 版。スマホで読みやすい簡素な見た目にする */
export function noticeHtml(n: Notice): string {
  const p = (s: string, style: string) => `<p style="margin:0 0 16px;${style}">${escape(s).replace(/\n/g, "<br>")}</p>`;
  return `<!doctype html><html lang="ja"><body style="margin:0;padding:24px 16px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP',sans-serif;color:#1c1917">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
<p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#c2410c">ぜんぶナビ 運営通知</p>
<h1 style="margin:0 0 16px;font-size:18px;line-height:1.5">${escape(n.title)}</h1>
${p(n.what, "font-size:15px;line-height:1.7")}
${n.action ? p(`対応：${n.action}`, "font-size:15px;line-height:1.7;font-weight:700") : ""}
<p style="margin:0 0 16px"><a href="${ADMIN_URL}" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px">管理画面を開く</a></p>
${n.detail ? p(n.detail, "font-size:12px;line-height:1.6;color:#78716c;border-top:1px solid #e7e5e4;padding-top:12px") : ""}
</div></body></html>`;
}

/**
 * 運営者にメールで知らせる（投稿の失敗・見送りなど、人が対応すべきことだけ）。
 * Amazon SES で送る。宛先は NOTIFY_EMAIL、送信用の鍵は SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY（送信だけを許可した専用ユーザー）。
 * 設定がなければ何もしない。通知の失敗で本来の処理を止めないよう、例外は投げずにログだけ残す。
 * データベースに依存させない（DB の障害を知らせるときにも使えるように）。
 */
export async function notifyOwner(n: Notice, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  const to = env.NOTIFY_EMAIL;
  const accessKeyId = env.SES_ACCESS_KEY_ID;
  const secretAccessKey = env.SES_SECRET_ACCESS_KEY;
  // 宛先の枠だけ作った状態（PLACEHOLDER）は未設定として扱う
  if (!to || to === "PLACEHOLDER" || !to.includes("@") || !accessKeyId || !secretAccessKey) return false;
  try {
    const aws = new AwsClient({ accessKeyId, secretAccessKey, region: REGION, service: "ses" });
    const res = await aws.fetch(`https://email.${REGION}.amazonaws.com/v2/email/outbound-emails`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        FromEmailAddress: FROM,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: `【ぜんぶナビ】${n.title}`, Charset: "UTF-8" },
            Body: { Text: { Data: noticeText(n), Charset: "UTF-8" }, Html: { Data: noticeHtml(n), Charset: "UTF-8" } },
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`SES ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return true;
  } catch (e) {
    console.error(JSON.stringify({ event: "notify", level: "error", message: "通知メールの送信に失敗", data: String(e) }));
    return false;
  }
}
