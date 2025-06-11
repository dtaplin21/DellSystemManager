'use client'

import dynamic from 'next/dynamic'

// @ts-ignore - Konva types don't match Next.js dynamic import types but work at runtime
const Stage = dynamic(() => import('react-konva').then(mod => mod.Stage), { ssr: false })
// @ts-ignore
const Layer = dynamic(() => import('react-konva').then(mod => mod.Layer), { ssr: false })
// @ts-ignore
const Rect = dynamic(() => import('react-konva').then(mod => mod.Rect), { ssr: false })
// @ts-ignore
const Line = dynamic(() => import('react-konva').then(mod => mod.Line), { ssr: false })
// @ts-ignore
const Text = dynamic(() => import('react-konva').then(mod => mod.Text), { ssr: false })
// @ts-ignore
const Circle = dynamic(() => import('react-konva').then(mod => mod.Circle), { ssr: false })

export { Stage, Layer, Rect, Line, Text, Circle } 