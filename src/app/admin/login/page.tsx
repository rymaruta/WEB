import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminEnabled, isAdmin } from "@/lib/admin/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "管理画面ログイン", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="mx-auto max-w-sm card p-6">
      <h1 className="mb-4 text-xl font-extrabold">管理画面</h1>
      {adminEnabled() ? <LoginForm /> : <p className="text-sm text-fg-muted">このサーバーでは管理画面を使えません（設定がありません）。</p>}
    </div>
  );
}
