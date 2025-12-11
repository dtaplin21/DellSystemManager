'use client'

import { useEffect, useRef } from 'react'
import { Patch } from '@/types/patch'

interface PatchCanvasProps {
  patches: Patch[]
  onPatchClick?: (patch: Patch) => void
  onPatchUpdate?: (patchId: string, updates: Partial<Patch>) => void
}

export default function PatchCanvas({ patches, onPatchClick, onPatchUpdate }: PatchCanvasProps) {
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

    // Draw patches as circles
    patches.forEach(patch => {
      if (!patch.isValid) return

      const centerX = patch.x
      const centerY = patch.y
      const radius = patch.radius

      // Draw circle
      ctx.fillStyle = patch.fill || '#ef4444'
      ctx.strokeStyle = patch.color || '#b91c1c'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()

      // Draw patch number
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(patch.patchNumber || patch.id, centerX, centerY)
    })
  }, [patches])

  return (
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full border border-gray-300"
        onClick={(e) => {
          if (!onPatchClick) return
          const canvas = canvasRef.current
          if (!canvas) return
          const rect = canvas.getBoundingClientRect()
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top
          
          // Find clicked patch
          const clickedPatch = patches.find(patch => {
            const dx = x - patch.x
            const dy = y - patch.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            return distance <= patch.radius
          })
          
          if (clickedPatch) {
            onPatchClick(clickedPatch)
          }
        }}
      />
    </div>
  )
}

