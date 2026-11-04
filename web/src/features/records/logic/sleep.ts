import type { Ev } from './types';

/**
 * - closed   : 寝た → 起きた がそろった睡眠
 * - open     : 寝た のあと起きた が無い、最新の睡眠（＝いま寝ている）
 * - unended  : 寝た のあと、起きた が無いまま次の 寝た が来た（起きた の記録漏れ）。時間は合計に入れない
 * - unstarted: 寝ていない状態での 起きた（寝た の記録漏れ）。時間は合計に入れない
 */
export type SleepState = 'closed' | 'open' | 'unended' | 'unstarted';

export interface SleepSession {
  /** 一覧・描画のキー（開始または終了の記録 ID） */
  key: string;
  /** 新しい「起きた」を書くときに使う、開始記録の sessionId */
  sessionId: string;
  start?: Date;
  end?: Date;
  startEventId?: string;
  endEventId?: string;
  startCaregiver?: string | null;
  endCaregiver?: string | null;
  state: SleepState;
}

/** 取得範囲の先頭からこの時間内の「寝ていない状態での起きた」は、寝たが範囲外にあるとみなして出さない */
const ORPHAN_END_LOOKBACK_MS = 86400000;
/** 2 台の端末から同じ「寝た」「起きた」をほぼ同時に記録した場合は 1 件として扱う */
export const SLEEP_DUPLICATE_MS = 30 * 60 * 1000;

export interface SleepEventLike {
  id: string;
  type: string;
  occurredAt: Date;
}
export interface SleepPair<T> { start?: T; end?: T; state: SleepState }

/**
 * 寝た／起きたを時刻順に読んで睡眠を組み立てる（記録の sessionId には頼らない）。
 * 訂正で時刻を入れ替えても、一覧で見える順序（例: 22:15 起きた → 22:30 寝た）どおりに解釈するので、
 * 利用者に訂正を求める「確認待ち」は作らない。終了時刻は推測で埋めない。
 * - 寝ている間の「寝た」: 30 分以内なら重複として無視。それより後なら前の睡眠は unended として閉じ、新しい睡眠を始める
 * - 起きている間の「起きた」: 直前の起床から 30 分以内なら重複として無視。それ以外は unstarted
 * 同時刻の 起きた と 寝た は、起きた を先に読む（起きてすぐ寝かしつけた、の順）。
 */
export function pairSleepEvents<T extends SleepEventLike>(events: T[], windowStart?: Date): SleepPair<T>[] {
  const list = events
    .filter((e) => e.type === 'sleep_start' || e.type === 'sleep_end')
    .slice()
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || (a.type === b.type ? 0 : a.type === 'sleep_end' ? -1 : 1));
  const out: SleepPair<T>[] = [];
  let cur: T | null = null;
  let lastWake: Date | null = null;
  for (const e of list) {
    const t = e.occurredAt.getTime();
    if (e.type === 'sleep_start') {
      if (cur) {
        if (t - cur.occurredAt.getTime() <= SLEEP_DUPLICATE_MS) continue;
        out.push({ start: cur, state: 'unended' });
      }
      cur = e;
    } else if (cur) {
      out.push({ start: cur, end: e, state: 'closed' });
      cur = null;
      lastWake = e.occurredAt;
    } else {
      if (lastWake && t - lastWake.getTime() <= SLEEP_DUPLICATE_MS) continue;
      lastWake = e.occurredAt;
      if (windowStart && t - windowStart.getTime() < ORPHAN_END_LOOKBACK_MS) continue;
      out.push({ end: e, state: 'unstarted' });
    }
  }
  if (cur) out.push({ start: cur, state: 'open' });
  return out;
}

export function buildSleepSessions(events: Ev[], windowStart?: Date): SleepSession[] {
  const active = events.filter((e) => e.status === 'active');
  return pairSleepEvents(active, windowStart).map(({ start: s, end: en, state }) => ({
    key: (s ?? en)!.id,
    sessionId: s?.sessionId ?? en?.sessionId ?? (s ?? en)!.id,
    start: s?.occurredAt,
    end: en?.occurredAt,
    startEventId: s?.id,
    endEventId: en?.id,
    startCaregiver: s?.caregiverUid,
    endCaregiver: en?.caregiverUid,
    state,
  }));
}

export type CurrentSleep =
  | { kind: 'sleeping'; since: Date; session: SleepSession }
  | { kind: 'awake'; lastWake: Date | null };

/** ホーム用の現在状態。最後の記録が「寝た」なら睡眠中、それ以外は起きている */
export function currentSleepState(sessions: SleepSession[]): CurrentSleep {
  const open = sessions.find((s) => s.state === 'open');
  if (open) return { kind: 'sleeping', since: open.start!, session: open };
  const last = sessions.reduce<Date | null>((m, s) => (s.end && (!m || s.end.getTime() > m.getTime()) ? s.end : m), null);
  return { kind: 'awake', lastWake: last };
}
