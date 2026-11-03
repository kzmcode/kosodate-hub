import { describe, expect, it } from 'vitest';
import { authErrorMessage, inviteErrorMessage, isInAppBrowser, isRecentAuthRequired, leaveErrorMessage, shouldFallbackToRedirect } from './errors';

describe('errors', () => {
  it('detects recent auth', () => {
    expect(isRecentAuthRequired({ code: 'failed-precondition', details: { reason: 'recent-auth-required' } })).toBe(true);
    expect(isRecentAuthRequired({ code: 'failed-precondition', details: { reason: 'x' } })).toBe(false);
  });
  it('maps invite reasons', () => {
    expect(inviteErrorMessage({ code: 'failed-precondition', details: { reason: 'expired' } }, 'f')).toContain('有効期限');
    expect(inviteErrorMessage({ code: 'x' }, 'f')).toBe('f');
  });
  it('maps leave', () => {
    expect(leaveErrorMessage({ details: { reason: 'transfer-required' } }, 'f')).toContain('移譲');
  });
  it('maps auth + fallback', () => {
    expect(authErrorMessage({ code: 'auth/invalid-credential' })).toContain('違います');
    expect(shouldFallbackToRedirect({ code: 'auth/popup-blocked' })).toBe(true);
    expect(shouldFallbackToRedirect({ code: 'auth/popup-closed-by-user' })).toBe(false);
  });
});

describe('isInAppBrowser', () => {
  const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const chrome = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  it('Google アプリ（iOS）を検出', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/350.0.0 Mobile/15E148 Safari/604.1')).toBe(true);
  });
  it('LINE・Instagram・Yahoo! JAPAN アプリ・Android WebView を検出', () => {
    expect(isInAppBrowser(`${safari} Line/14.0.0`)).toBe(true);
    expect(isInAppBrowser(`${safari} Instagram 300.0`)).toBe(true);
    expect(isInAppBrowser(`${safari} YJApp-IOS jp.co.yahoo.ipn.appli/4.0`)).toBe(true);
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe(true);
  });
  it('Safari・Chrome は対象外', () => {
    expect(isInAppBrowser(safari)).toBe(false);
    expect(isInAppBrowser(chrome)).toBe(false);
  });
});
