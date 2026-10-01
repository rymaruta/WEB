"use client";

/** 「下書きを今すぐ作る」のボタン。作る時刻より前に押したときは、自動の作成が行われなくなることを確かめる */
export function BuildButton({ action, label, early, buildAt }: { action: () => Promise<void>; label: string; early: boolean; buildAt: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (early && !window.confirm(`今作ると、${buildAt} の自動の下書き作成は行われず、今の時点のニュースで下書きができます。作りますか？\n（間違えて作ったときは、下書きの画面の「この下書きを取り消す」で戻せます）`)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:border-accent">
        {label}
      </button>
    </form>
  );
}
