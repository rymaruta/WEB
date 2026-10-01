import { AwsClient } from "aws4fetch";

const REGION = "ap-northeast-1";
const FROM = "ぜんぶナビ <alerts@zenbu-navi.com>";

/**
 * 運営者にメールで知らせる（投稿の失敗・見送りなど、人が対応すべきことだけ）。
 * Amazon SES で送る。宛先は NOTIFY_EMAIL、送信用の鍵は SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY（送信だけを許可した専用ユーザー）。
 * 設定がなければ何もしない。通知の失敗で本来の処理を止めないよう、例外は投げずにログだけ残す。
 * データベースに依存させない（DB の障害を知らせるときにも使えるように）。
 */
export async function notifyOwner(text: string, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  const to = env.NOTIFY_EMAIL;
  const accessKeyId = env.SES_ACCESS_KEY_ID;
  const secretAccessKey = env.SES_SECRET_ACCESS_KEY;
  // 宛先の枠だけ作った状態（PLACEHOLDER）は未設定として扱う
  if (!to || to === "PLACEHOLDER" || !to.includes("@") || !accessKeyId || !secretAccessKey) return false;
  const subject = `【ぜんぶナビ】${text.split("\n")[0].slice(0, 60)}`;
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
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: { Text: { Data: `${text}\n\n管理画面: https://zenbu-navi.com/admin`, Charset: "UTF-8" } },
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
