import { describe, expect, it } from 'vitest';
import { PENDING_REAUTH_TTL_MS, parsePendingReauth, serializePendingReauth } from './reauthResume';

describe('parsePendingReauth', () => {
  const now = 1_000_000_000;
  const raw = serializePendingReauth({ id: 'account', data: 'u1', typed: '家族', at: now - 1000 });
  it('id が一致し期限内なら返す', () => {
    expect(parsePendingReauth(raw, 'account', now)).toEqual({ id: 'account', data: 'u1', typed: '家族', at: now - 1000 });
  });
  it('id が違えば null', () => {
    expect(parsePendingReauth(raw, 'family', now)).toBeNull();
  });
  it('期限切れ・未来の時刻は null', () => {
    expect(parsePendingReauth(raw, 'account', now + PENDING_REAUTH_TTL_MS)).toBeNull();
    expect(parsePendingReauth(serializePendingReauth({ id: 'a', at: now + 5 }), 'a', now)).toBeNull();
  });
  it('壊れた値は null', () => {
    expect(parsePendingReauth(null, 'a', now)).toBeNull();
    expect(parsePendingReauth('{', 'a', now)).toBeNull();
    expect(parsePendingReauth('{"id":"a"}', 'a', now)).toBeNull();
    expect(parsePendingReauth('null', 'a', now)).toBeNull();
  });
});
