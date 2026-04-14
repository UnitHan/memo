/**
 * voiceRecorder.ts
 * MediaRecorder(오디오 녹음) + SpeechRecognition(받아쓰기) 동시 실행
 *
 * MP3 인코딩 전략:
 *   AudioWorkletNode (PCM 캡처, ScriptProcessorNode 대체 - Web Audio API 표준)
 *   → Web Worker (mp3-worker.js) 내부에서 importScripts('/lame.all.js') 로 lamejs 로드
 *   → Vite ESM 모듈 시스템 완전 우회 → MPEGMode 오류 없음
 *   → UI 스레드 블로킹 없음
 */

import { invoke } from '@tauri-apps/api/core';

export type TranscriptCallback = (text: string, isFinal: boolean) => void;
export type TimerCallback = (seconds: number) => void;

function uint8ToBase64(data: Uint8Array): string {
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < data.length; i += CHUNK) {
    binary += String.fromCharCode(...data.subarray(i, Math.min(i + CHUNK, data.length)));
  }
  return btoa(binary);
}

export class VoiceRecorder {
  private audioCtx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private silentGain: GainNode | null = null;
  private worker: Worker | null = null;
  private stream: MediaStream | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private _seconds = 0;
  private _running = false;

  async start(onTranscript: TranscriptCallback, onTimer: TimerCallback): Promise<void> {
    if (this._running) return;
    this._running = true;
    this._seconds = 0;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    // ── AudioContext + AudioWorkletNode (PCM 캡처, 표준 방식) ──
    this.audioCtx = new AudioContext();
    const source = this.audioCtx.createMediaStreamSource(this.stream);

    // AudioWorklet 모듈 등록 (public/audio-worklet.js)
    await this.audioCtx.audioWorklet.addModule('/audio-worklet.js');
    this.workletNode = new AudioWorkletNode(this.audioCtx, 'pcm-processor');

    // 무음 출력 (스피커 에코 방지)
    this.silentGain = this.audioCtx.createGain();
    this.silentGain.gain.value = 0;

    source.connect(this.workletNode);
    this.workletNode.connect(this.silentGain);
    this.silentGain.connect(this.audioCtx.destination);

    // ── Web Worker 시작 (MP3 실시간 인코딩) ──
    this.worker = new Worker('/mp3-worker.js');
    this.worker.postMessage({ type: 'start', sampleRate: this.audioCtx.sampleRate });

    // WorkletNode → Worker로 PCM 전달
    this.workletNode.port.onmessage = (e) => {
      if (!this._running || !this.worker) return;
      this.worker.postMessage({ type: 'encode', pcm: e.data }, [e.data]);
    };

    // ── SpeechRecognition (받아쓰기 병렬 실행) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (SR) {
      this.recognition = new SR();
      this.recognition.lang = 'ko-KR';
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.recognition.onresult = (e: any) => {
        const result = e.results[e.results.length - 1];
        onTranscript(result[0].transcript as string, result.isFinal as boolean);
      };
      this.recognition.onerror = () => { /* silent */ };
      this.recognition.onend = () => {
        if (this._running) {
          try { this.recognition?.start(); } catch { /* ignore */ }
        }
      };
      try { this.recognition.start(); } catch { /* ignore */ }
    }

    // ── 타이머 ──
    this.timerInterval = setInterval(() => {
      this._seconds++;
      onTimer(this._seconds);
    }, 1000);
  }

  /** 녹음 중지 → Worker에서 MP3 완성 → Music 폴더 저장 → 경로 반환 / 에러 시 throw */
  async stop(): Promise<string> {
    this._running = false;

    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    if (this.recognition) { try { this.recognition.stop(); } catch { /* ignore */ } this.recognition = null; }

    // 오디오 그래프 해제
    if (this.workletNode) { this.workletNode.port.onmessage = null; this.workletNode.disconnect(); this.workletNode = null; }
    if (this.silentGain) { this.silentGain.disconnect(); this.silentGain = null; }
    if (this.audioCtx) { await this.audioCtx.close(); this.audioCtx = null; }
    if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }

    if (!this.worker) throw new Error('녹음기가 초기화되지 않았습니다.');

    return new Promise((resolve, reject) => {
      const worker = this.worker!;

      worker.onmessage = async (e) => {
        if (e.data.type !== 'done') return;

        worker.terminate();
        this.worker = null;

        const mp3 = new Uint8Array(e.data.mp3);
        console.log(`✅ MP3 인코딩 완료: ${mp3.length} bytes`);

        if (mp3.length < 100) {
          reject(new Error('MP3 인코딩 결과가 너무 짧습니다. 더 길게 녹음해 주세요.'));
          return;
        }

        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const filename = `메모녹음_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.mp3`;

        try {
          const savedPath = await invoke<string>('save_audio_to_music', {
            dataBase64: uint8ToBase64(mp3),
            filename,
          });
          console.log(`💾 MP3 저장 완료: ${savedPath}`);
          resolve(savedPath);
        } catch (err) {
          reject(new Error(`파일 저장 실패: ${err}`));
        }
      };

      worker.onerror = (e) => {
        reject(new Error(`Worker 오류: ${e.message}`));
      };

      // Worker에 인코딩 종료 및 MP3 반환 요청
      worker.postMessage({ type: 'stop' });
    });
  }

  get seconds(): number { return this._seconds; }
  get isRunning(): boolean { return this._running; }
}
