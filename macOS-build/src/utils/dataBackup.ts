/**
 * dataBackup.ts
 * localStorage 데이터를 Tauri 앱 데이터 폴더에 자동 백업/복원
 * 업데이트, 재설치 시 메모 손실 방지
 */

import { BaseDirectory, writeTextFile, readTextFile, exists } from '@tauri-apps/plugin-fs';

// 백업할 localStorage 키 목록
const BACKUP_KEYS = [
  'auto_saved_memo',        // 작성 중인 메모
  'memo_history',           // 저장된 메모 목록
  'sensitive_keywords_db',  // 학습된 민감 키워드
  'window_opacity',         // 투명도 설정
  'gemini_api_key',         // API 키 (난독화된 상태)
];

const BACKUP_FILE = 'memo_backup.json';

/**
 * localStorage → 파일 백업
 */
export async function backupLocalStorage(): Promise<void> {
  try {
    const backup: Record<string, string | null> = {};
    
    // 모든 백업 대상 키 수집
    for (const key of BACKUP_KEYS) {
      backup[key] = localStorage.getItem(key);
    }
    
    // JSON으로 저장
    const json = JSON.stringify(backup, null, 2);
    await writeTextFile(BACKUP_FILE, json, { baseDir: BaseDirectory.AppData });
    
    console.log('💾 localStorage 백업 완료:', Object.keys(backup).length, '개 항목');
  } catch (error) {
    console.error('❌ localStorage 백업 실패:', error);
  }
}

/**
 * 파일 → localStorage 복원
 */
export async function restoreLocalStorage(): Promise<boolean> {
  try {
    // 백업 파일 존재 확인
    const fileExists = await exists(BACKUP_FILE, { baseDir: BaseDirectory.AppData });
    if (!fileExists) {
      console.log('📂 백업 파일 없음 (첫 실행)');
      return false;
    }
    
    // 백업 파일 읽기
    const json = await readTextFile(BACKUP_FILE, { baseDir: BaseDirectory.AppData });
    const backup: Record<string, string | null> = JSON.parse(json);
    
    let restoredCount = 0;
    
    // localStorage로 복원 (기존 데이터가 없는 경우만)
    for (const key of BACKUP_KEYS) {
      const currentValue = localStorage.getItem(key);
      const backupValue = backup[key];
      
      // 현재 localStorage에 값이 없고 백업에는 있는 경우만 복원
      if (!currentValue && backupValue) {
        localStorage.setItem(key, backupValue);
        restoredCount++;
        console.log(`✅ 복원됨: ${key}`);
      }
    }
    
    if (restoredCount > 0) {
      console.log(`💾 localStorage 복원 완료: ${restoredCount}개 항목`);
      return true;
    } else {
      console.log('✓ localStorage 데이터 정상 (복원 불필요)');
      return false;
    }
  } catch (error) {
    console.error('❌ localStorage 복원 실패:', error);
    return false;
  }
}

/**
 * 앱 시작 시 자동 복원 후 주기적 백업 시작
 */
export async function initDataBackup(): Promise<void> {
  // 1. 복원 시도 (데이터 손실 시 복구)
  await restoreLocalStorage();
  
  // 2. 즉시 백업 (최신 상태 저장)
  await backupLocalStorage();
  
  // 3. 5분마다 자동 백업
  setInterval(() => {
    backupLocalStorage();
  }, 5 * 60 * 1000); // 5분
  
  // 4. 윈도우 종료 시 백업
  window.addEventListener('beforeunload', () => {
    backupLocalStorage();
  });
  
  console.log('🔄 자동 백업 시스템 활성화 (5분 간격)');
}
