'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PanelAIChatProps {
  projectId: string
  projectInfo?: {
    projectName?: string
    location?: string
    description?: string
  }
  userId?: string
  userTier?: string
}

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: string
}

interface MCPChatResponse {
  success: boolean
  response?: string
  error?: string
  status?: string
  cost?: number
}

const createMessageId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8003'

const DEFAULT_SUGGESTIONS = [
  'Summarize the latest project insights.',
  'Trigger a comprehensive MCP workflow.',
  'Analyze recent document uploads for compliance gaps.',
  'What are the recommended next steps for this project?'
]

export default function PanelAIChat({
  projectId,
  projectInfo,
  userId,
  userTier
}: PanelAIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: createMessageId(),
      role: 'assistant',
      content: 'Hello! I can coordinate MCP agents, run workflows, analyze documents, and generate panel or QC insights. How can I assist you today?',
      timestamp: new Date().toISOString()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, isSending])

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message])
  }, [])

  const buildContextPayload = useCallback(() => {
    return {
      projectId,
      projectInfo,
      history: messages.slice(-15).map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }))
    }
  }, [messages, projectId, projectInfo])

  const sendToMCP = useCallback(async (prompt: string): Promise<MCPChatResponse> => {
    const payload = {
      projectId: projectId, // Backend expects projectId at top level
      user_id: userId || 'anonymous',
      user_tier: userTier || 'free_user',
      message: prompt,
      context: buildContextPayload()
    }

    // Get authentication headers
    const { getAuthHeaders } = await import('@/lib/api');
    const authHeaders = await getAuthHeaders();

    const response = await fetch(`${AI_SERVICE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || `MCP chat failed with status ${response.status}`)
    }

    return response.json()
  }, [userId, userTier, buildContextPayload, projectId])

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
      const result = await sendToMCP(trimmed)

      appendMessage({
        id: createMessageId(),
        role: 'assistant',
        content: result.response || result.error || 'I did not receive a response from the MCP service.',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error occurred.'
      appendMessage({
        id: createMessageId(),
        role: 'assistant',
        content: `I ran into an issue while contacting the MCP agents: ${errorMessage}`,
        timestamp: new Date().toISOString()
      })
    } finally {
      setIsSending(false)
    }
  }, [appendMessage, isSending, sendToMCP])

  const handleSubmit = useCallback(() => {
    void handleSendMessage(inputMessage)
  }, [handleSendMessage, inputMessage])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const quickActions = useMemo(() => DEFAULT_SUGGESTIONS, [])

  return (
    <div className="flex h-full flex-col">
      <header className="mb-4 space-y-2 border-b pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">AI Operations Chat</h2>
            <p className="text-sm text-muted-foreground">
              Interact with MCP-enabled agents to automate workflows and gather insights.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Connected project: <span className="font-medium text-foreground">{projectInfo?.projectName || projectId}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map(action => (
            <Button
              key={action}
              size="sm"
              variant="secondary"
              onClick={() => handleSendMessage(action)}
              disabled={isSending}
            >
              {action}
            </Button>
          ))}
        </div>
      </header>

      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto rounded-lg border bg-background p-4"
      >
        <div className="space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-2xl rounded-lg px-4 py-3 text-sm shadow-sm',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                )}
              >
                <div className="whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </div>
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
              <div
                className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                style={{ animationDelay: '0.15s' }}
              />
              <div
                className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                style={{ animationDelay: '0.3s' }}
              />
              <span>Agents coordinating…</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(event) => setInputMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the task you need the MCP agents to handle..."
          className="flex-1 rounded-lg border px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          disabled={isSending}
        />
        <Button onClick={handleSubmit} disabled={isSending || !inputMessage.trim()}>
          {isSending ? 'Sending…' : 'Send'}
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Try instructions like “Run a comprehensive workflow”, “Analyze the latest QC logs for issues”, or “Summarize panel layout risks”.
      </p>
    </div>
  )
}
