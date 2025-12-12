import { useState } from 'react'
import { MessageSquare, Plus, Trash2, Edit2, Edit } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

interface ChatSession {
  id: string
  title: string
  updatedAt: string
  preview?: string
}

interface ChatHistorySidebarProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewChat: () => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, newTitle: string) => void
}

export function ChatHistorySidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession
}: ChatHistorySidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  // Group sessions by date
  const groupedSessions = sessions.reduce((groups, session) => {
    const date = new Date(session.updatedAt)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let key = 'Older'
    if (date.toDateString() === today.toDateString()) {
      key = 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday'
    } else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
      key = 'Previous 7 Days'
    }

    if (!groups[key]) groups[key] = []
    groups[key].push(session)
    return groups
  }, {} as Record<string, ChatSession[]>)

  const groupOrder = ['Today', 'Yesterday', 'Previous 7 Days', 'Older']

  const handleRename = (session: ChatSession) => {
    if (editTitle.trim() && editTitle !== session.title) {
      onRenameSession(session.id, editTitle.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="w-64 flex flex-col h-full bg-card/70 border-r border-border/60 backdrop-blur">
      {/* New Chat Button */}
      <div className="p-3">
        <Button
          onClick={onNewChat}
          variant="outline"
          className="w-full justify-between group hover:border-primary/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Chat
          </span>
          <Edit className="w-4 h-4 opacity-50 group-hover:opacity-100" />
        </Button>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm italic border border-dashed border-border/60 rounded-lg mx-1">
            <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
            No chat history yet
          </div>
        ) : (
          <div className="space-y-6">
            {groupOrder.map(group => {
              const groupSessions = groupedSessions[group]
              if (!groupSessions?.length) return null

              return (
                <div key={group}>
                  <h3 className="text-xs font-semibold text-muted-foreground px-2 mb-2">{group}</h3>
                  <div className="space-y-0.5">
                    {groupSessions.map(session => (
                      <div
                        key={session.id}
                        className={cn(
                          "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm relative",
                          currentSessionId === session.id
                            ? "bg-accent/50 text-accent-foreground"
                            : "hover:bg-accent/30 text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => onSelectSession(session.id)}
                      >
                        {editingId === session.id ? (
                          <input
                            autoFocus
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => handleRename(session)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(session)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="flex-1 bg-transparent border-b border-primary/50 focus:outline-none px-1 py-0.5"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="flex-1 truncate pr-12">
                            {session.title || 'New Chat'}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-card/80 rounded-md shadow-sm border border-border/50 backdrop-blur-sm">
                          <button 
                            className="p-1.5 hover:text-primary transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditTitle(session.title)
                              setEditingId(session.id)
                            }}
                            title="Rename"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button 
                            className="p-1.5 hover:text-destructive transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteSession(session.id)
                            }}
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
