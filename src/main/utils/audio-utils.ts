/**
 * Audio utility functions for PCM data conversion.
 */

/**
 * Convert Float32Array PCM (-1..1) to Int16Array PCM for Azure/Google APIs.
 */
export function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16Array
}

/**
 * Convert Float32Array PCM to a WAV buffer (Int16, mono).
 */
export function encodeWav(pcmData: Float32Array, sampleRate: number): Buffer {
  const int16Data = float32ToInt16(pcmData)
  const dataLength = int16Data.length * 2 // 2 bytes per sample
  const buffer = Buffer.alloc(44 + dataLength)

  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataLength, 4)
  buffer.write('WAVE', 8)

  // fmt chunk
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // chunk size
  buffer.writeUInt16LE(1, 20) // PCM format
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28) // byte rate
  buffer.writeUInt16LE(2, 32) // block align
  buffer.writeUInt16LE(16, 34) // bits per sample

  // data chunk
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataLength, 40)

  // Write samples
  for (let i = 0; i < int16Data.length; i++) {
    buffer.writeInt16LE(int16Data[i], 44 + i * 2)
  }

  return buffer
}

/**
 * Merge multiple Float32Arrays into one.
 */
export function mergeFloat32Arrays(arrays: Float32Array[]): Float32Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Float32Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}
