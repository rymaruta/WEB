"use server";

import { headers } from "next/headers";
import { logEvent } from "@/lib/events";
import { notifyOwner } from "@/lib/notify";
import { CONTACT_KINDS } from "./kinds";

type ContactState = { ok?: string; error?: string } | undefined;


/** 同じ送り主からの連続送信を抑える（サーバーの記憶だけ。再起動で消えてよい） */
const recent = new Map<string, number>();
const MIN_INTERVAL_MS = 60_000;

/** お問い合わせを受け付け、運営者にメールで知らせる（届かなかったときのため記録にも残す） */
export async function sendContact(_: ContactState, form: FormData): Promise<ContactState> {
  // ロボットだけが埋める見えない欄
  if (String(form.get("website") ?? "")) return { ok: "送信しました。" };
  const kind = String(form.get("kind") ?? "");
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const email = String(form.get("email") ?? "").trim().slice(0, 120);
  const body = String(form.get("body") ?? "").trim();
  if (!CONTACT_KINDS.includes(kind as (typeof CONTACT_KINDS)[number])) return { error: "お問い合わせの種類を選んでください。" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "返信先のメールアドレスを正しく入力してください。" };
  if (body.length < 10) return { error: "お問い合わせの内容を10文字以上で入力してください。" };
  if (body.length > 4000) return { error: "お問い合わせの内容は4000文字以内でお願いします。" };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const last = recent.get(ip);
  if (last && Date.now() - last < MIN_INTERVAL_MS) return { error: "続けて送信されました。1分ほどおいてから、もう一度お試しください。" };
  recent.set(ip, Date.now());

  await logEvent("info", "contact", `お問い合わせ: ${kind}`, undefined, { kind, name, email, body });
  await notifyOwner({
    title: `お問い合わせ: ${kind}`,
    what: `${name || "お名前なし"}（${email}）からお問い合わせがありました。`,
    action: "返信は、このメールではなく上のアドレスへ送ってください。",
    detail: body,
    url: "https://zenbu-navi.com/admin/logs",
    button: "記録を開く",
  });
  return { ok: "送信しました。内容を確認のうえ、ご入力のメールアドレスへ返信いたします（数日かかる場合があります）。" };
}
