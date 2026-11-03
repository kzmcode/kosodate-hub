import { useEffect, useState, type FormEvent } from 'react';
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, getRedirectResult, sendEmailVerification,
  sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect,
} from 'firebase/auth';
import { auth, enableTrustedDeviceCache, isTrustedDevice } from '../../lib/firebase';
import { Button, Card, Field, Logo, SegmentedControl, TextInput } from '../../components';
import { authErrorMessage, isInAppBrowser, shouldFallbackToRedirect } from './logic/errors';
import { defaultKeepSignedIn, isStandaloneDisplay } from './logic/keepSignedIn';
import { INVITE_STORAGE_KEY, buildInviteLink, isValidToken } from './logic/invite';
import { copyText } from './util';
import './account.css';

type Mode = 'login' | 'register';

/** S01 ログイン。ログイン後の遷移は routes.tsx の RedirectIfAuthed（location.state.from）が行う */
export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const inApp = isInAppBrowser(navigator.userAgent);
  const [keep, setKeep] = useState(() =>
    defaultKeepSignedIn(isTrustedDevice(), isStandaloneDisplay(window.matchMedia?.bind(window), navigator as { standalone?: boolean })),
  );

  /**
   * ログイン前に「保持する」の選択を反映する（ログイン情報の保存先と信頼端末フラグ）。
   * Firestore のキャッシュ種別は読み込み時に決まるため、切り替えた場合はログイン後に再読み込みする
   */
  async function applyKeep(): Promise<boolean> {
    const changed = keep !== isTrustedDevice();
    await enableTrustedDeviceCache(keep);
    return changed;
  }

  useEffect(() => {
    getRedirectResult(auth).catch((e) => setError(authErrorMessage(e)));
  }, []);

  /** Safari / Chrome で開き直すためのリンク。招待から来た場合は招待リンクを作り直す（トークンは URL から退避済み） */
  function reopenLink(): string {
    let token: string | null = null;
    try { token = sessionStorage.getItem(INVITE_STORAGE_KEY); } catch { /* ignore */ }
    return token && isValidToken(token) ? buildInviteLink(window.location.origin, token) : `${window.location.origin}/login`;
  }
  async function copyReopenLink() {
    setError(''); setInfo('');
    if (await copyText(reopenLink())) setInfo('リンクをコピーしました。Safari または Chrome のアドレス欄に貼り付けて開いてください。');
    else setError('コピーできませんでした。画面のメニューから「ブラウザで開く」を選んでください。');
  }

  async function google() {
    setError(''); setInfo('');
    // アプリ内ブラウザではポップアップもリダイレクトも失敗する（リダイレクトは Firebase のエラー画面で止まる）ので試さない
    if (inApp) {
      setError('このアプリ内ブラウザでは Google ログインができません。上の「リンクをコピー」から Safari または Chrome で開くか、メールアドレスでログインしてください。');
      return;
    }
    setBusy(true);
    const provider = new GoogleAuthProvider();
    // ポップアップはボタン押下の直後に開く必要がある（先に await するとブロックされる）。
    // 保存先の切り替えは Auth 内部で順番に処理されるので、ログインより先に反映される
    const keepApplied = applyKeep();
    keepApplied.catch(() => undefined); // 失敗はログイン後の await で扱う
    try {
      await signInWithPopup(auth, provider);
      if (await keepApplied) { window.location.reload(); return; }
    } catch (e) {
      if (shouldFallbackToRedirect(e)) {
        try { await keepApplied; await signInWithRedirect(auth, provider); return; } catch (e2) { setError(authErrorMessage(e2)); }
      } else setError(authErrorMessage(e));
    }
    setBusy(false);
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      const changed = await applyKeep();
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        try { await sendEmailVerification(cred.user); } catch { /* 後で設定画面から再送できる */ }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      if (changed) window.location.reload();
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  }

  async function reset() {
    setError(''); setInfo('');
    if (!email.trim()) { setError('パスワード再設定のため、メールアドレスを入力してください。'); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('登録されているメールアドレスであれば、再設定用のメールを送信しました。届かない場合は迷惑メールも確認してください。');
    } catch (e) { setError(authErrorMessage(e)); }
  }

  return (
    <main className="page stack acc-narrow">
      <div className="row"><Logo size={56} /><h1 style={{ margin: 0 }}>Kosodate Hub</h1></div>
      <p className="muted">夫婦で育児の記録・予定・健康情報を共有するアプリです。</p>

      {inApp && (
        <Card tone="warning" className="stack">
          <strong>Safari または Chrome で開いてください</strong>
          <p className="small">LINE・Google アプリ・Gmail などのアプリ内ブラウザでは Google ログインができません。画面のメニューから「ブラウザで開く」を選ぶか、下のボタンでリンクをコピーして Safari / Chrome に貼り付けてください。招待から来た場合も、コピーしたリンクから参加できます。</p>
          <Button onClick={copyReopenLink}>リンクをコピー</Button>
        </Card>
      )}

      <Card className="stack">
        <Button variant="primary" block loading={busy} onClick={google}>Google でログイン</Button>
      </Card>

      <Card className="stack">
        <label className="row">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          <strong>この端末でログインを保持する（自分専用の端末）</strong>
        </label>
        <p className="small muted">オンにすると、アプリを閉じてもログインしたままになり、記録をこの端末に保存してオフラインでも使えます。家族で共用する端末や借りた端末ではオフにしてください（タブやアプリを閉じるとログアウトします）。あとから「設定 → この端末」で変更できます。</p>
      </Card>

      <Card>
        <form className="stack" onSubmit={submit}>
          <SegmentedControl<Mode>
            ariaLabel="メールでの認証方法"
            options={[{ value: 'login', label: 'ログイン' }, { value: 'register', label: '新規登録' }]}
            value={mode} onChange={setMode}
          />
          <Field label="メールアドレス">
            {(p) => <TextInput {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="パスワード" hint={mode === 'register' ? '6文字以上' : undefined}>
            {(p) => (
              <TextInput {...p} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
            )}
          </Field>
          {error && <p className="acc-err" role="alert">{error}</p>}
          {info && <p role="status">{info}</p>}
          <Button type="submit" variant="primary" block loading={busy}>{mode === 'register' ? '登録して確認メールを送る' : 'ログイン'}</Button>
          {mode === 'login' && <Button variant="ghost" onClick={reset}>パスワードを忘れた場合</Button>}
        </form>
      </Card>

      <Card tone="warning" className="stack">
        <strong>ログイン方法にご注意ください</strong>
        <p className="small">以前と別の方法（Google とメールなど）で新しくアカウントを作ると、データが空に見えます。以前使った方法でログインしてください。ログイン方法を変えただけで、同じ人のアカウントとして自動で統合されることはありません。</p>
        <p className="small">招待リンクから来た方は、ログイン後に自動で参加画面に戻ります。</p>
      </Card>
    </main>
  );
}
