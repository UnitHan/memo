// AudioWorkletProcessor: 마이크 PCM 데이터를 메인 스레드(Web Worker)로 전달
// ScriptProcessorNode(deprecated) 대체
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      // Float32Array 복사 후 Transferable로 전송 (zero-copy)
      const copy = input[0].slice();
      this.port.postMessage(copy.buffer, [copy.buffer]);
    }
    return true; // true 반환 = 계속 실행
  }
}

registerProcessor('pcm-processor', PCMProcessor);
