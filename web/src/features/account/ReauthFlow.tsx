import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  EmailAuthProvider, GoogleAuthProvider, getRedirectResult, reauthenticateWithCredential, reauthenticateWithPopup,
  reauthenticateWithRedirect, type User,
} from 'firebase/auth';
import { apiErrorMessage } from '../../lib/api';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../context';
import { Button, Field, Sheet, TextInput } from '../../components';
import { authErrorMessage, deleteErrorMessage, isRecentAuthRequired, shouldFallbackToRedirect } from './logic/errors';
import { isStandaloneDisplay } from './logic/keepSignedIn';
import { PENDING_REAUTH_KEY, parsePendingReauth, serializePendingReauth } from './logic/reauthResume';

export interface FlowProps {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
  /**
   * リダイレクトで本人確認したあと、戻ってきた画面でこのシートを開き直すための識別子（画面内で一意）。
   * 戻ったら onResume(resumeData) が呼ばれるので、呼び出し側は open を true にする
   */
  resumeId: string;
  resumeData?: string;
  onResume: (data?: string) => void;
  /** 入力して一致が必要な確認文字列（家族名など） */
  confirmText?: string; confirmLabel?: string; actionLabel: string;
  run: () => Promise<void>;
  /** 実行ボタンの見た目（既定 danger） */
  variant?: 'danger' | 'primary';
  /** API エラーの文言変換（既定は削除系） */
  errorMessage?: (e: unknown, fallback: string) => string;
}

function readPending(id: string) {
  try {
    const p = parsePendingReauth(sessionStorage.getItem(PENDING_REAUTH_KEY), id, Date.now());
    if (p) sessionStorage.removeItem(PENDING_REAUTH_KEY);
    return p;
  } catch {
    return null;
  }
}
function writePending(v: string | null) {
  try { if (v) sessionStorage.setItem(PENDING_REAUTH_KEY, v); else sessionStorage.removeItem(PENDING_REAUTH_KEY); } catch { /* ignore */ }
}

// getRedirectResult は Google 本人確認の部品も準備する。先に済ませておかないと、ボタンを押してから
// 準備を待つ間にユーザー操作の扱いが切れ、ポップアップがブロックされる（iOS では何も表示されない）。
// リダイレクトの結果は 1 回しか取れないので、ページ読み込みごとに 1 回だけ呼んで共有する
let redirectResult: ReturnType<typeof getRedirectResult> | null = null;
function sharedRedirectResult() {
  return (redirectResult ??= getRedirectResult(auth));
}

/** 再認証 → （確認文字列の一致）→ 実行 の共通シート */
export function DangerFlow({
  open, onClose, title, children, resumeId, resumeData, onResume, confirmText, confirmLabel, actionLabel, run,
  variant = 'danger', errorMessage = deleteErrorMessage,
}: FlowProps) {
  const { user } = useAuth();
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** リダイレクトで本人確認済み（次の押下では再認証せずに実行する） */
  const [verified, setVerified] = useState(false);
  const hasGoogle = !!user?.providerData.some((p) => p.providerId === 'google.com');
  const hasPassword = !!user?.providerData.some((p) => p.providerId === 'password');
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;

  useEffect(() => {
    const pending = readPending(resumeId);
    const result = sharedRedirectResult();
    if (!pending) { result.catch(() => undefined); return; }
    let alive = true;
    result.then(
      (r) => {
        if (!alive) return;
        setTyped(pending.typed ?? '');
        if (r) setVerified(true);
        else setError('本人確認が完了しませんでした。もう一度実行してください。');
        onResumeRef.current(pending.data);
      },
      (e: unknown) => {
        if (!alive) return;
        setTyped(pending.typed ?? '');
        setError(authErrorMessage(e));
        onResumeRef.current(pending.data);
      },
    );
    return () => { alive = false; };
  }, [resumeId]);

  function close() {
    setVerified(false); setError(''); setTyped(''); setPassword('');
    onClose();
  }

  async function reauthWithRedirect(u: User, provider: GoogleAuthProvider) {
    writePending(serializePendingReauth({ id: resumeId, data: resumeData, typed, at: Date.now() }));
    try {
      await reauthenticateWithRedirect(u, provider); // ページが移動する
    } catch (e) {
      writePending(null);
      throw e;
    }
  }

  async function go() {
    if (!user) return;
    setBusy(true); setError('');
    if (!verified) {
      try {
        if (hasGoogle) {
          const provider = new GoogleAuthProvider();
          // ホーム画面のアプリではポップアップが開かない・戻らないことがあるため、最初からリダイレクト
          if (isStandaloneDisplay(window.matchMedia?.bind(window), navigator as { standalone?: boolean })) {
            await reauthWithRedirect(user, provider);
            return;
          }
          try {
            await reauthenticateWithPopup(user, provider);
          } catch (e) {
            if (!shouldFallbackToRedirect(e)) throw e;
            await reauthWithRedirect(user, provider);
            return;
          }
        } else if (hasPassword && user.email) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
        else throw Object.assign(new Error('unsupported'), { code: 'auth/unknown' });
      } catch (e) { setError(authErrorMessage(e)); setBusy(false); return; }
    }
    try {
      await run();
      setBusy(false); setPassword(''); setTyped(''); setVerified(false);
    } catch (e) {
      setVerified(false);
      setError(isRecentAuthRequired(e) ? '本人確認の有効時間が切れました。もう一度実行してください。' : errorMessage(e, apiErrorMessage(e)));
      setBusy(false);
    }
  }
  const matches = !confirmText || typed.trim() === confirmText;
  const needsPassword = !verified && !hasGoogle;
  return (
    <Sheet open={open} onClose={close} title={title}
      footer={<div className="row"><Button onClick={close} disabled={busy}>キャンセル</Button><Button variant={variant} loading={busy} disabled={!matches || (needsPassword && !password)} onClick={go}>{verified ? '実行する' : actionLabel}</Button></div>}>
      <div className="stack">
        {children}
        {confirmText && (
          <Field label={confirmLabel ?? `確認のため「${confirmText}」と入力`}>
            {(p) => <TextInput {...p} autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />}
          </Field>
        )}
        {verified
          ? <p className="small">本人確認が完了しました。内容を確認して「実行する」を押してください。</p>
          : hasGoogle
            ? <p className="small muted">実行時に Google で本人確認を行います。</p>
            : <Field label="パスワード（本人確認）">{(p) => <TextInput {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>}
        {error && <p className="acc-err" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}
