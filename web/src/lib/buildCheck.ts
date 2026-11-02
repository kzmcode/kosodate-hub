// ビルド時の安全確認（vite.config.ts から使用）
// 開発用の設定は .env.development.local に置く（本番ビルドでは読まれない）。ここは混入したときの最後の防波堤

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

function isLocalUrl(v: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(v).hostname);
  } catch {
    return false;
  }
}

/** 本番ビルドで開発用の設定（エミュレータ接続・demo- プロジェクト・ローカルの GAS）が有効なら失敗させる */
export function assertNoEmulatorsInProduction(mode: string, env: Record<string, string | undefined>): void {
  if (mode !== 'production') return;
  const problems: string[] = [];
  if (env.VITE_USE_EMULATORS === 'true') problems.push('VITE_USE_EMULATORS=true');
  const projectId = env.VITE_FIREBASE_PROJECT_ID ?? '';
  if (projectId.startsWith('demo-')) problems.push(`VITE_FIREBASE_PROJECT_ID=${projectId}`);
  const gas = env.VITE_GAS_ENDPOINT ?? '';
  if (isLocalUrl(gas)) problems.push(`VITE_GAS_ENDPOINT=${gas}`);
  if (problems.length) {
    throw new Error(
      `本番ビルドに開発用の設定が入っています: ${problems.join(', ')}。` +
        '開発用の値は .env.development.local に置き、.env.local や環境変数に残さないでください。',
    );
  }
}
