import { normalizeCompany } from "@/lib/ai/prompt";

export const companyPath = (name: string) => `/company/${encodeURIComponent(name)}`;

/** URL の企業名を読む（エンコードされたまま届いた場合も戻す） */
export function readCompanyParam(raw: string): string {
  let name = raw;
  try {
    if (/%[0-9a-f]{2}/i.test(raw)) name = decodeURIComponent(raw);
  } catch {}
  return normalizeCompany(name).slice(0, 30);
}
