import { describe, expect, it } from 'vitest';
import { defaultKeepSignedIn, isStandaloneDisplay } from './keepSignedIn';

describe('isStandaloneDisplay', () => {
  const mm = (matches: boolean) => () => ({ matches });
  it('display-mode: standalone なら true', () => {
    expect(isStandaloneDisplay(mm(true), {})).toBe(true);
  });
  it('iOS の navigator.standalone でも true', () => {
    expect(isStandaloneDisplay(mm(false), { standalone: true })).toBe(true);
    expect(isStandaloneDisplay(undefined, { standalone: true })).toBe(true);
  });
  it('ブラウザのタブなら false', () => {
    expect(isStandaloneDisplay(mm(false), {})).toBe(false);
    expect(isStandaloneDisplay(() => { throw new Error('x'); }, {})).toBe(false);
  });
});

describe('defaultKeepSignedIn', () => {
  it('信頼端末かホーム画面のアプリなら保持', () => {
    expect(defaultKeepSignedIn(true, false)).toBe(true);
    expect(defaultKeepSignedIn(false, true)).toBe(true);
    expect(defaultKeepSignedIn(false, false)).toBe(false);
  });
});
