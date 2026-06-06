import { useEffect, useState } from 'react'

interface WaveformVisualizerProps {
  isActive: boolean
}

/**
 * Simple animated waveform visualizer.
 * Shows that the microphone is capturing audio.
 */
export function WaveformVisualizer({ isActive }: WaveformVisualizerProps) {
  const [bars, setBars] = useState<number[]>([4, 4, 4, 4, 4, 4, 4, 4, 4, 4])

  useEffect(() => {
    if (!isActive) {
      setBars([4, 4, 4, 4, 4, 4, 4, 4, 4, 4])
      return
    }

    // Animate bars with random heights to simulate audio activity
    const interval = setInterval(() => {
      setBars(
        Array.from({ length: 10 }, () =>
          Math.max(3, Math.random() * 24)
        )
      )
    }, 150)

    return () => clearInterval(interval)
  }, [isActive])

  return (
    <div className="flex-shrink-0 flex items-center justify-center gap-[2px] h-10 px-4">
      {bars.map((height, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{
            height: `${height}px`,
            width: '3px',
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  )
}
