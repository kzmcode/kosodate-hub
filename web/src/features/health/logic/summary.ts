// 受診用表示の期間集計（純粋関数）。診断・評価はしない
import { addDaysStr } from '../../../lib/time';
import { pairSleepEvents } from '../../records/logic/sleep';

export interface LogEvent {
  id: string;
  type: string;
  occurredAt: Date;
  endedAt?: Date;
  payload: Record<string, unknown>;
  caregiverUid?: string | null;
  note?: string;
}

export interface DaySummary {
  date: string;
  feedingCount: number;
  feedingMl: number;
  feedingMlUnknownCount: number;
  diaperCount: number;
  urineCount: number;
  stoolCount: number;
  vomitCount: number;
  sleepSeconds: number;
  sleepOpen: boolean;
  medicationCount: number;
  temperatures: number[];
  symptomCount: number;
}

/** 期間 [from, to]（両端含む）の日付配列 */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  if (from > to) return out;
  for (let d = from, i = 0; d <= to && i < 400; d = addDaysStr(d, 1), i++) out.push(d);
  return out;
}

/** 終了日と日数から [from,to] */
export function lastNDays(endDate: string, days: number): { from: string; to: string } {
  return { from: addDaysStr(endDate, -(Math.max(1, days) - 1)), to: endDate };
}

type DateOf = (d: Date) => string;

function empty(date: string): DaySummary {
  return { date, feedingCount: 0, feedingMl: 0, feedingMlUnknownCount: 0, diaperCount: 0, urineCount: 0, stoolCount: 0, vomitCount: 0, sleepSeconds: 0, sleepOpen: false, medicationCount: 0, temperatures: [], symptomCount: 0 };
}

/**
 * 日別集計。dateOf は Date → yyyy-MM-dd（TZ基準）。dayStart は日付 → その日の0:00 Date
 * 睡眠は寝た／起きたを時刻順に対応づけ（記録画面と同じ規則）、日境界でクリップ。終了が無い最新の開始は確定合計に含めず sleepOpen。
 */
export function summarizeByDay(
  events: LogEvent[],
  dates: string[],
  dateOf: DateOf,
  dayStart: (date: string) => Date,
): DaySummary[] {
  const map = new Map(dates.map((d) => [d, empty(d)]));
  for (const e of events) {
    const s = map.get(dateOf(e.occurredAt));
    if (!s) continue;
    const p = e.payload;
    switch (e.type) {
      case 'feeding': {
        s.feedingCount++;
        const ml = p.consumedMl;
        if (typeof ml === 'number') s.feedingMl += ml; else s.feedingMlUnknownCount++;
        break;
      }
      case 'diaper':
        s.diaperCount++;
        if (p.urine === 'yes') s.urineCount++;
        if (p.stool === 'yes') s.stoolCount++;
        break;
      case 'vomit': s.vomitCount++; break;
      case 'medication_taken': s.medicationCount++; break;
      case 'temperature': if (typeof p.celsius === 'number') s.temperatures.push(p.celsius); break;
      case 'symptom': s.symptomCount++; break;
    }
  }
  // 睡眠
  for (const p of pairSleepEvents(events)) {
    if (p.state === 'open' && p.start) {
      const s = map.get(dateOf(p.start.occurredAt));
      if (s) s.sleepOpen = true;
      continue;
    }
    if (p.state !== 'closed' || !p.start || !p.end) continue;
    const st = p.start.occurredAt.getTime();
    const en = p.end.occurredAt.getTime();
    for (const d of dates) {
      const a = dayStart(d).getTime();
      const b = dayStart(addDaysStr(d, 1)).getTime();
      const lo = Math.max(a, st);
      const hi = Math.min(b, en);
      if (hi > lo) map.get(d)!.sleepSeconds += Math.round((hi - lo) / 1000);
    }
  }
  return dates.map((d) => map.get(d)!);
}

/** 成長グラフ用: 時系列の点（値のあるもののみ） */
export function growthSeries(
  events: { occurredAt: Date; payload: Record<string, unknown> }[],
  key: 'heightCm' | 'weightGrams',
): { t: number; v: number }[] {
  return events
    .filter((e) => typeof e.payload[key] === 'number')
    .map((e) => ({ t: e.occurredAt.getTime(), v: e.payload[key] as number }))
    .sort((a, b) => a.t - b.t);
}
