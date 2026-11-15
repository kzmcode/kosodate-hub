import { dayRange } from '../../../lib/time';
import { clipInterval } from './interval';
import type { SleepSession } from './sleep';
import type { Ev } from './types';

export interface DailySummary {
  breastCount: number;
  formulaCount: number;
  expressedCount: number;
  /** ミルク・搾母乳の既知の量の合計 */
  milkMl: number;
  /** ミルク・搾母乳で量未入力の件数 */
  milkUnknownCount: number;
  /** ミルクの既知の量の合計（milkMl の内訳） */
  formulaMl: number;
  /** 搾母乳（搾った母乳を飲ませた量）の既知の量の合計（milkMl の内訳） */
  expressedMl: number;
  /** 母乳の授乳時間（左右の合計・秒）。時間が入力された記録だけ */
  breastSeconds: number;
  breastLeftSeconds: number;
  breastRightSeconds: number;
  /** 母乳で左右とも時間未入力の件数 */
  breastTimeUnknownCount: number;
  /** 母乳で量が記録されていた場合の合計（参考） */
  pumpingCount: number;
  pumpingMl: number;
  pumpingUnknownCount: number;
  diaperCount: number;
  urineCount: number;
  stoolCount: number;
  /** 尿または便が「未確認」の件数 */
  diaperUnknownCount: number;
  vomitCount: number;
  bathCount: number;
  otherCount: number;
  /** 確定した睡眠（その日の境界で切った秒数） */
  sleepConfirmedSeconds: number;
  /** 未終了（現在まで）の暫定秒数 */
  sleepOpenSeconds: number;
}

/** 当日（dateStr）の集計。void は呼び出し側で除外済み（念のためここでも除外） */
export function summarizeDay(events: Ev[], sessions: SleepSession[], dateStr: string, now: Date = new Date()): DailySummary {
  const { start, end } = dayRange(dateStr);
  const s: DailySummary = {
    breastCount: 0, formulaCount: 0, expressedCount: 0, milkMl: 0, milkUnknownCount: 0, formulaMl: 0, expressedMl: 0,
    breastSeconds: 0, breastLeftSeconds: 0, breastRightSeconds: 0, breastTimeUnknownCount: 0,
    pumpingCount: 0, pumpingMl: 0, pumpingUnknownCount: 0,
    diaperCount: 0, urineCount: 0, stoolCount: 0, diaperUnknownCount: 0,
    vomitCount: 0, bathCount: 0, otherCount: 0,
    sleepConfirmedSeconds: 0, sleepOpenSeconds: 0,
  };
  for (const e of events) {
    if (e.status !== 'active') continue;
    const t = e.occurredAt.getTime();
    if (t < start.getTime() || t >= end.getTime()) continue;
    switch (e.type) {
      case 'feeding': {
        const m = e.payload.method;
        const ml = e.payload.consumedMl;
        if (m === 'breast') {
          s.breastCount++;
          const l = e.payload.leftSeconds, r = e.payload.rightSeconds;
          const ls = typeof l === 'number' ? l : 0, rs = typeof r === 'number' ? r : 0;
          if (typeof l !== 'number' && typeof r !== 'number') s.breastTimeUnknownCount++;
          s.breastLeftSeconds += ls;
          s.breastRightSeconds += rs;
          s.breastSeconds += ls + rs;
        } else {
          if (m === 'formula') s.formulaCount++;
          else s.expressedCount++;
          if (typeof ml === 'number') {
            s.milkMl += ml;
            if (m === 'formula') s.formulaMl += ml; else s.expressedMl += ml;
          } else s.milkUnknownCount++;
        }
        break;
      }
      case 'pumping':
        s.pumpingCount++;
        if (typeof e.payload.expressedMl === 'number') s.pumpingMl += e.payload.expressedMl;
        else s.pumpingUnknownCount++;
        break;
      case 'diaper':
        if (e.payload.changed !== false) s.diaperCount++;
        if (e.payload.urine === 'yes') s.urineCount++;
        if (e.payload.stool === 'yes') s.stoolCount++;
        if (e.payload.urine === 'unknown' || e.payload.stool === 'unknown') s.diaperUnknownCount++;
        break;
      case 'vomit': s.vomitCount++; break;
      case 'bath': s.bathCount++; break;
      case 'memo': s.otherCount++; break;
      default: break;
    }
  }
  for (const ss of sessions) {
    if (!ss.start) continue;
    if (ss.state === 'closed' && ss.end) {
      const c = clipInterval(ss.start, ss.end, start, end);
      if (c) s.sleepConfirmedSeconds += (c.end.getTime() - c.start.getTime()) / 1000;
    } else if (ss.state === 'open') {
      const c = clipInterval(ss.start, now, start, end);
      if (c) s.sleepOpenSeconds += (c.end.getTime() - c.start.getTime()) / 1000;
    }
  }
  return s;
}
