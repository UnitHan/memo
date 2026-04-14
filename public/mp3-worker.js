// MP3 인코딩 Web Worker
// lame.all.js를 importScripts로 로드 (Vite ESM 모듈 시스템 완전 우회 → MPEGMode 오류 없음)
importScripts('/lame.all.js');

// lamejs() 실행 후 lamejs.Mp3Encoder 사용 가능
let encoder = null;
let mp3Chunks = [];

self.onmessage = function (e) {
  const { type } = e.data;

  if (type === 'start') {
    // sampleRate는 정수여야 함 (lamejs 요구사항)
    encoder = new lamejs.Mp3Encoder(1, Math.round(e.data.sampleRate), 128);
    mp3Chunks = [];

  } else if (type === 'encode') {
    if (!encoder) return;

    // Float32 PCM → Int16
    const pcm = new Float32Array(e.data.pcm);
    const int16 = new Int16Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      const s = Math.max(-1, Math.min(1, pcm[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const buf = encoder.encodeBuffer(int16);
    if (buf.length > 0) {
      mp3Chunks.push(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
    }

  } else if (type === 'stop') {
    if (encoder) {
      const tail = encoder.flush();
      if (tail.length > 0) {
        mp3Chunks.push(new Uint8Array(tail.buffer, tail.byteOffset, tail.byteLength));
      }
    }

    const totalBytes = mp3Chunks.reduce((sum, c) => sum + c.length, 0);
    const mp3 = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of mp3Chunks) {
      mp3.set(chunk, offset);
      offset += chunk.length;
    }

    // Transferable로 전송 (복사 없이 메인 스레드로 이동)
    self.postMessage({ type: 'done', mp3: mp3 }, [mp3.buffer]);

    encoder = null;
    mp3Chunks = [];
  }
};
