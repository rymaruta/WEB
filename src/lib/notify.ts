import { credentialsFromEnv, sendDirectMessage } from "@/lib/x/client";

/**
 * 運営者に X の DM で知らせる（投稿の失敗・見送りなど、人が対応すべきことだけ）。
 * 宛先は X_NOTIFY_USER_ID（運営者の個人アカウントの数字の ID）。未設定なら何もしない。
 * 通知の失敗で本来の処理を止めないよう、例外は投げずにログだけ残す。
 */
export async function notifyOwner(text: string, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  const to = env.X_NOTIFY_USER_ID;
  const creds = credentialsFromEnv(env);
  if (!to || !creds) return false;
  try {
    await sendDirectMessage(creds, to, `【ぜんぶナビ】${text}`);
    return true;
  } catch (e) {
    // データベースに依存させない（DB の障害を知らせるときにも使えるように）
    console.error(JSON.stringify({ event: "notify", level: "error", message: "DM の送信に失敗", data: String(e) }));
    return false;
  }
}
