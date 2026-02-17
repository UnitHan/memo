/**
 * networkMonitor.ts
 * 네트워크 연결 상태 모니터링 및 절전 모드 복구
 */

let isOnline = navigator.onLine;
let lastOfflineTime: number | null = null;

/**
 * 네트워크 연결 상태 확인
 */
export function isNetworkOnline(): boolean {
  return navigator.onLine;
}

/**
 * 네트워크 재연결 감지
 */
export function wasRecentlyOffline(): boolean {
  if (!lastOfflineTime) return false;
  
  // 최근 30초 이내에 오프라인이었던 경우
  const timeSinceOffline = Date.now() - lastOfflineTime;
  return timeSinceOffline < 30000;
}

/**
 * 네트워크 상태 모니터링 시작
 */
export function initNetworkMonitor(
  onOnline?: () => void,
  onOffline?: () => void
): () => void {
  const handleOnline = () => {
    console.log('🌐 네트워크 연결됨');
    isOnline = true;
    lastOfflineTime = null;
    onOnline?.();
  };

  const handleOffline = () => {
    console.warn('📡 네트워크 연결 끊김');
    isOnline = false;
    lastOfflineTime = Date.now();
    onOffline?.();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('👁️ 앱이 포그라운드로 전환됨');
      
      // 절전 모드에서 복구되었을 가능성
      if (!navigator.onLine) {
        console.warn('⚠️ 오프라인 상태로 복구됨');
        handleOffline();
      } else if (lastOfflineTime) {
        console.log('✅ 온라인 상태로 복구됨');
        handleOnline();
      }
    } else {
      console.log('💤 앱이 백그라운드로 전환됨');
    }
  };

  // 이벤트 리스너 등록
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // 초기 상태 로그
  console.log('🌐 네트워크 모니터 시작:', isOnline ? '온라인' : '오프라인');

  // 클린업 함수 반환
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

/**
 * 네트워크 연결 대기 (재시도 로직)
 */
export async function waitForNetwork(timeoutMs: number = 10000): Promise<boolean> {
  if (navigator.onLine) return true;

  console.log('⏳ 네트워크 연결 대기 중...');

  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkConnection = () => {
      if (navigator.onLine) {
        console.log('✅ 네트워크 연결 복구됨');
        resolve(true);
        return;
      }

      if (Date.now() - startTime > timeoutMs) {
        console.warn('⏱️ 네트워크 연결 대기 시간 초과');
        resolve(false);
        return;
      }

      // 500ms마다 재확인
      setTimeout(checkConnection, 500);
    };

    checkConnection();
  });
}
