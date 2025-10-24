'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import type { Panel } from '@/types/panel'
import { apiClient } from '@/lib/apiClient'

interface PanelAIChatProps {
  projectId: string
  projectInfo?: {
    projectName?: string
    location?: string
    description?: string
    manager?: string
    material?: string
  }
  panels: Panel[]
  onPanelsUpdated?: (panels: Panel[]) => void
}

type ChatRole = 'user' | 'assistant'

interface ChatAction {
  type: string
  description: string
  panelId?: string
  panelNumber?: string
  timestamp?: string
}

interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: string
  actions?: ChatAction[]
}

interface ChatResponse {
  success: boolean
  reply: string
  actions?: ChatAction[]
  panels?: Array<Record<string, any>>
  suggestions?: string[]
  error?: string
}

const DEFAULT_SUGGESTIONS = [
  'List all panels in this project.',
  'Create a new panel 40ft x 100ft near the north boundary.',
  'Optimize the panel layout for balanced spacing.',
  'Move panel P1 to coordinates 200, 150.'
]

const createMessageId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const mapPanelFromApi = (panel: any): Panel => ({
  id: panel.id || `panel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  width: Number(panel.width ?? 0),
  height: Number(panel.height ?? 0),
  x: Number(panel.x ?? 0),
  y: Number(panel.y ?? 0),
  rotation: Number(panel.rotation ?? 0),
  isValid: true,
  shape: panel.shape || 'rectangle',
  panelNumber: panel.panelNumber || panel.panel_number || '',
  rollNumber: panel.rollNumber || panel.roll_number || '',
  color: panel.color,
  fill: panel.fill,
  material: panel.material,
  thickness: panel.thickness,
  meta: {
    repairs: [],
    airTest: { result: 'pending' }
  }
})

export default function PanelAIChat({
  projectId,
  projectInfo,
  panels,
  onPanelsUpdated
}: PanelAIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: createMessageId(),
      role: 'assistant',
      content: "I'm ready to help with panel layout tasks. Try asking me to create, move, resize, or summarize panels.",
      timestamp: new Date().toISOString()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isSending])

  const derivedQuickActions = useMemo(() => {
    const base = suggestions.length ? suggestions : DEFAULT_SUGGESTIONS
    if (!panels.length) {
      return base.slice(0, 4)
    }

    const firstPanel = panels[0]
    const panelLabel = firstPanel.panelNumber || firstPanel.rollNumber || firstPanel.id

    const panelAwareActions = [
      `Move panel ${panelLabel} to ${Math.round(firstPanel.x + 50)}, ${Math.round(firstPanel.y + 50)}.`,
      `Resize panel ${panelLabel} to ${Math.max(20, Math.round(firstPanel.width))}ft x ${Math.max(20, Math.round(firstPanel.height))}ft.`,
      `Rotate panel ${panelLabel} by 15 degrees.`,
      ...base
    ]

    return Array.from(new Set(panelAwareActions)).slice(0, 4)
  }, [panels, suggestions])

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message])
  }, [])

  const handleSendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isSending) {
      return
    }

    const timestamp = new Date().toISOString()
    appendMessage({
      id: createMessageId(),
      role: 'user',
      content: trimmed,
      timestamp
    })
    setInputMessage('')
    setIsSending(true)

    try {
      const response = await apiClient.request<ChatResponse>('/api/ai/chat', {
        method: 'POST',
        body: {
          projectId,
          message: trimmed,
          context: { projectInfo }
        }
      })

      if (Array.isArray(response.panels)) {
        const mappedPanels = response.panels.map(mapPanelFromApi)
        onPanelsUpdated?.(mappedPanels)
      }

      if (Array.isArray(response.suggestions) && response.suggestions.length) {
        setSuggestions(response.suggestions)
      } else {
        setSuggestions(DEFAULT_SUGGESTIONS)
      }

      appendMessage({
        id: createMessageId(),
        role: 'assistant',
        content: response.reply || 'I did not receive a response this time.',
        timestamp: new Date().toISOString(),
        actions: response.actions
      })
    } catch (error) {
      console.error('AI chat request failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error occurred.'
      appendMessage({
        id: createMessageId(),
        role: 'assistant',
        content: `I ran into an issue while processing that: ${errorMessage}`,
        timestamp: new Date().toISOString()
      })
    } finally {
      setIsSending(false)
    }
  }, [appendMessage, isSending, projectId, projectInfo, onPanelsUpdated])

  const handleSubmit = useCallback(() => {
    void handleSendMessage(inputMessage)
  }, [handleSendMessage, inputMessage])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleQuickAction = useCallback((prompt: string) => {
    void handleSendMessage(prompt)
  }, [handleSendMessage])

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          {derivedQuickActions.map(action => (
            <Button
              key={action}
              variant="secondary"
              size="sm"
              onClick={() => handleQuickAction(action)}
              disabled={isSending}
            >
              {action}
            </Button>
          ))}
        </div>
      </div>

      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto mb-4 p-3 border rounded bg-muted/30 space-y-3"
      >
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background border'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">
                {message.content}
              </div>
            </div>
            {message.actions && message.actions.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground border-l pl-3 space-y-1">
                {message.actions.map(action => (
                  <div key={`${message.id}-${action.type}-${action.panelId || action.description}`}>
                    <span className="font-medium text-foreground">{action.type}</span>
                    {': '}
                    {action.description}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
            <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.15s' }} />
            <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.3s' }} />
            <span>Thinking…</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(event) => setInputMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the AI to create, move, resize, or summarize panels…"
          className="flex-1 p-3 border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          disabled={isSending}
        />
        <Button onClick={handleSubmit} disabled={isSending || !inputMessage.trim()} className="shrink-0">
          {isSending ? 'Sending…' : 'Send'}
        </Button>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Tip: You can say things like “Create a 40ft x 100ft panel and move it to the north boundary” or “Summarize all panels in this project.”
      </div>
    </div>
  )
}
