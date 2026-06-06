/**
 * AudioWorklet processor for low-latency microphone capture.
 *
 * CRITICAL: This processor extracts PCM data for ASR processing.
 * Its output is NOT connected to audioContext.destination — this ensures
 * the original microphone audio NEVER reaches the speakers.
 *
 * Runs on the audio rendering thread for minimal latency.
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.accumulator = new Float32Array(0)
    this.targetSampleRate = 16000
    this.chunkSize = 1536 // 96ms at 16kHz
  }

  process(inputs, outputs, _parameters) {
    const input = inputs[0]
    if (!input || input.length === 0) {
      return true
    }

    const channelData = input[0]
    if (!channelData || channelData.length === 0) {
      return true
    }

    // Downsample to 16kHz if needed
    let pcmData = channelData
    if (sampleRate !== this.targetSampleRate) {
      pcmData = this.downsample(channelData, sampleRate, this.targetSampleRate)
    }

    // Accumulate audio until we have a full chunk
    const combined = new Float32Array(this.accumulator.length + pcmData.length)
    combined.set(this.accumulator, 0)
    combined.set(pcmData, this.accumulator.length)

    // Send full chunks to the main thread
    let offset = 0
    while (offset + this.chunkSize <= combined.length) {
      const chunk = combined.slice(offset, offset + this.chunkSize)
      this.port.postMessage(chunk.buffer, [chunk.buffer])
      offset += this.chunkSize
    }

    // Keep remaining samples for next time
    if (offset < combined.length) {
      this.accumulator = combined.slice(offset)
    } else {
      this.accumulator = new Float32Array(0)
    }

    // IMPORTANT: Do NOT pass audio through to output.
    // The output remains silent — this is how we prevent mic audio
    // from reaching the speakers.
    return true
  }

  /**
   * Simple linear interpolation downsampler.
   */
  downsample(data, inputRate, outputRate) {
    if (inputRate === outputRate) return new Float32Array(data)

    const ratio = inputRate / outputRate
    const outputLength = Math.floor(data.length / ratio)
    const result = new Float32Array(outputLength)

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio
      const srcIndexFloor = Math.floor(srcIndex)
      const srcIndexCeil = Math.min(srcIndexFloor + 1, data.length - 1)
      const t = srcIndex - srcIndexFloor
      result[i] = data[srcIndexFloor] * (1 - t) + data[srcIndexCeil] * t
    }

    return result
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor)
