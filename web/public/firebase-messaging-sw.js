/* FCM 背景通知用 Service Worker（Vite ビルド対象外。public/ からそのまま配信）
 *
 * 設定値の渡し方: アプリ側 (lib/firebase.ts getMessagingIfSupported) が
 *   /firebase-messaging-sw.js?apiKey=..&projectId=..&messagingSenderId=..&appId=..
 * の形で登録するため、ここではクエリ文字列から読み取る。ビルド時の置換手順は不要。
 * 通知本文はサーバー側で定型文のみ（健康の自由文・薬名を含めない）。
 */
importScripts('/notification-url.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');

// 以前の版はスコープ '/' に登録していたため、PWA 本体の sw.js の代わりに待機していることがある。
// その端末で「更新する」を押したときに切り替わるよう、本体と同じ SKIP_WAITING に応じる
// （切り替え後に読み込まれる新しいアプリが、'/' に sw.js、専用スコープにこの SW を登録し直す）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const params = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});
const messaging = firebase.messaging();

// data メッセージのみの場合に通知を表示（notification 付きは SDK が自動表示）
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const d = payload.data || {};
  self.registration.showNotification(d.title || 'Kosodate Hub', {
    body: d.body || '新しいお知らせがあります',
    icon: '/icons/icon-192.png',
    data: { url: self.resolveNotificationUrl(d.url, self.location.origin) },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // 送信側データを信用せず、クリック時にも同一オリジンへ解決し直す
  const url = self.resolveNotificationUrl(event.notification.data && event.notification.data.url, self.location.origin);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) { c.navigate(url); return c.focus(); }
      return clients.openWindow(url);
    })
  );
});
