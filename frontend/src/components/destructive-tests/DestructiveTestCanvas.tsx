'use client'

import { useEffect, useRef } from 'react'
import { DestructiveTest } from '@/types/destructiveTest'

interface DestructiveTestCanvasProps {
  destructiveTests: DestructiveTest[]
  onTestClick?: (test: DestructiveTest) => void
  onTestUpdate?: (testId: string, updates: Partial<DestructiveTest>) => void
}

export default function DestructiveTestCanvas({ destructiveTests, onTestClick, onTestUpdate }: DestructiveTestCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw grid
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    const gridSize = 50
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Draw destructive tests as rectangles
    destructiveTests.forEach(test => {
      if (!test.isValid) return

      // Draw rectangle
      ctx.fillStyle = test.fill || '#f59e0b'
      ctx.strokeStyle = test.color || '#d97706'
      ctx.lineWidth = 2
      ctx.fillRect(test.x, test.y, test.width, test.height)
      ctx.strokeRect(test.x, test.y, test.width, test.height)

      // Draw sample ID
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        test.sampleId || test.id,
        test.x + test.width / 2,
        test.y + test.height / 2
      )
    })
  }, [destructiveTests])

  return (
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full border border-gray-300"
        onClick={(e) => {
          if (!onTestClick) return
          const canvas = canvasRef.current
          if (!canvas) return
          const rect = canvas.getBoundingClientRect()
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top
          
          // Find clicked test
          const clickedTest = destructiveTests.find(test => {
            return x >= test.x && x <= test.x + test.width &&
                   y >= test.y && y <= test.y + test.height
          })
          
          if (clickedTest) {
            onTestClick(clickedTest)
          }
        }}
      />
    </div>
  )
}

