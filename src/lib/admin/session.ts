import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createToken, SESSION_COOKIE, SESSION_DAYS, verifyToken } from "./token";

export { adminEnabled, passwordMatches, SESSION_COOKIE, verifyToken } from "./token";

/**
 * 管理画面のログイン。運営者 1 人だけが使う前提で、パスワード（ADMIN_PASSWORD）で入り、
 * 署名付きの Cookie（ADMIN_SESSION_SECRET で HMAC）でログイン状態を保つ。
 * どちらかの環境変数がなければ、管理画面には誰も入れない（安全側に倒す）。
 */

export async function startSession() {
  const token = createToken();
  if (!token) throw new Error("管理画面の設定（ADMIN_SESSION_SECRET）がありません");
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** ログインしているか（画面・Server Action・API の入口で毎回確かめる） */
export const isAdmin = cache(async (): Promise<boolean> => verifyToken((await cookies()).get(SESSION_COOKIE)?.value));

/** ログインしていなければログイン画面へ */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
