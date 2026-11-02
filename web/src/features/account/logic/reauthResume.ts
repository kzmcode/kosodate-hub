// 本人確認をリダイレクトで行ったとき、戻ってきた画面で確認シートを開き直すための保存情報（sessionStorage）

export const PENDING_REAUTH_KEY = 'ch.reauthPending';
/** これより古い保存は無視する（Google 側で放置して戻ってきた場合など） */
export const PENDING_REAUTH_TTL_MS = 10 * 60 * 1000;

export interface PendingReauth {
  /** どの確認シートか（DangerFlow の resumeId） */
  id: string;
  /** シートを開き直すのに必要な値（移譲先 uid など） */
  data?: string;
  /** 入力済みの確認文字列 */
  typed?: string;
  at: number;
}

export function serializePendingReauth(p: PendingReauth): string {
  return JSON.stringify(p);
}

/** 保存値を読み、id が一致し期限内のものだけ返す */
export function parsePendingReauth(raw: string | null | undefined, id: string, now: number): PendingReauth | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PendingReauth> | null;
    if (!v || v.id !== id || typeof v.at !== 'number') return null;
    if (v.at > now || now - v.at > PENDING_REAUTH_TTL_MS) return null;
    return {
      id: v.id,
      at: v.at,
      ...(typeof v.data === 'string' ? { data: v.data } : {}),
      ...(typeof v.typed === 'string' ? { typed: v.typed } : {}),
    };
  } catch {
    return null;
  }
}
