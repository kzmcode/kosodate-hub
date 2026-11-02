// ログイン画面の「この端末でログインを保持する」。保持＝信頼端末（ログイン情報とオフライン保存を端末に残す）

/** ホーム画面に追加した PWA として開いているか（iOS は navigator.standalone） */
export function isStandaloneDisplay(
  matchMedia: ((q: string) => { matches: boolean }) | undefined,
  nav: { standalone?: boolean },
): boolean {
  try {
    if (matchMedia?.('(display-mode: standalone)').matches) return true;
  } catch { /* ignore */ }
  return nav.standalone === true;
}

/**
 * チェックの初期値。すでに信頼端末なら保持、未設定ならホーム画面のアプリとして開いたときだけ保持する
 * （ブラウザのタブは共用 PC の可能性があるので既定はオフ）
 */
export function defaultKeepSignedIn(trusted: boolean, standalone: boolean): boolean {
  return trusted || standalone;
}
