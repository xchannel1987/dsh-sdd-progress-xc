/**
 * dsh-sdd-progress-xc — browser half (initial).
 *
 * Registers a right-sidebar tab showing SDD task progress + ledger.
 */
import { useState, useEffect, useCallback, createElement as h } from 'react'
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'

export const inject = ['slots', 'sidebarRightTabs']

const TAB_ID = 'dsh-sdd-progress-xc/sdd-progress'
const TAB_KIND = 'sdd-progress'

interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}

interface ProgressData {
  ok: boolean
  sessionId?: string
  requirementName?: string
  cwd?: string
  todos?: TodoItem[]
  ledger?: string
  error?: string
}

// ── Simple markdown renderer (MVP, line-based) ──

function renderMarkdown(md: string): string {
  if (!md) return ''
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 style="margin:8px 0 4px;font-size:13px">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="margin:12px 0 6px;font-size:14px">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="margin:16px 0 8px;font-size:15px">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
    .replace(/^- (.+)$/gm, '<li style="margin:2px 0;list-style:none">$1</li>')
    .replace(/^---$/gm, '<hr style="margin:12px 0;border:none;border-top:1px solid #e0e0e0">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#4f7cff">$1</a>')
    .replace(/\n\n/g, '</p><p style="margin:6px 0">')
  return '<div style="font-size:12px;line-height:1.6">' + html + '</div>'
}

// ── Status helpers ──

function statusIcon(status: string): string {
  switch (status) {
    case 'completed': return '✓'
    case 'in_progress': return '⏳'
    default: return '○'
  }
}

function statusBg(status: string): string {
  switch (status) {
    case 'completed': return '#e8f5e9'
    case 'in_progress': return '#fff3e0'
    default: return '#f5f5f5'
  }
}

function statusFg(status: string): string {
  switch (status) {
    case 'completed': return '#2e7d32'
    case 'in_progress': return '#e65100'
    default: return '#757575'
  }
}

// ── Main component ──

function SddProgressBody({ sessionId }: { sessionId?: string }) {
  const [data, setData] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProgress = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const q = sessionId ? '?sessionId=' + encodeURIComponent(sessionId) : ''
      const res = await fetch('/api/dsh-sdd-progress-xc/progress' + q, { cache: 'no-store' })
      const json = await res.json() as ProgressData
      if (json.ok) {
        setData(json)
      } else {
        setError(json.error || 'unknown error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchProgress()
    const interval = setInterval(fetchProgress, 5000)
    return () => clearInterval(interval)
  }, [fetchProgress])

  if (loading && !data) {
    return h('div', { style: { padding: 16, color: '#999', fontSize: 13 } }, 'Loading SDD progress...')
  }

  if (error) {
    return h('div', { style: { padding: 16, color: '#d32f2f', fontSize: 13 } }, 'Error: ' + error)
  }

  if (!data) {
    return h('div', { style: { padding: 16, color: '#999', fontSize: 13 } }, 'No data')
  }

  const todos = data.todos || []
  const done = todos.filter(t => t.status === 'completed').length
  const active = todos.filter(t => t.status === 'in_progress').length
  const pending = todos.length - done - active

  return h('div', {
    style: { padding: 12, overflow: 'auto', fontSize: 13, lineHeight: 1.5, height: '100%' }
  },
    // Header
    h('div', { style: { marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e0e0e0' } },
      h('div', { style: { fontSize: 11, color: '#999', marginBottom: 4 } },
        'Requirement: ' + (data.requirementName || 'unknown')
      ),
      h('div', { style: { fontSize: 11, color: '#999' } },
        'Session: ' + (data.sessionId || 'unknown').slice(0, 12) + '...'
      )
    ),

    // Summary pills
    h('div', { style: { display: 'flex', gap: 8, marginBottom: 8, fontSize: 12 } },
      h('span', { style: { color: '#2e7d32' } }, '✓ ' + done),
      h('span', { style: { color: '#e65100' } }, '⏳ ' + active),
      h('span', { style: { color: '#757575' } }, '○ ' + pending),
      h('span', { style: { color: '#999' } }, '/ ' + todos.length + ' total')
    ),

    // Tasks list
    todos.length > 0 && h('div', { style: { marginBottom: 16 } },
      h('div', { style: { fontWeight: 600, fontSize: 13, marginBottom: 6 } }, 'Tasks'),
      ...todos.map((t, i) =>
        h('div', {
          key: i,
          style: {
            padding: '5px 8px',
            marginBottom: 3,
            background: statusBg(t.status),
            borderRadius: 4,
            fontSize: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
          }
        },
          h('span', { style: { color: statusFg(t.status), flexShrink: 0 } }, statusIcon(t.status)),
          h('span', {
            style: {
              color: t.status === 'completed' ? '#999' : '#333',
              textDecoration: t.status === 'completed' ? 'line-through' : 'none',
            }
          }, t.content)
        )
      )
    ),

    // Ledger
    data.ledger && h('div', null,
      h('div', {
        style: {
          fontWeight: 600, fontSize: 13, marginBottom: 6,
          paddingTop: 8, borderTop: '1px solid #e0e0e0',
        }
      }, 'Progress Ledger'),
      h('div', { dangerouslySetInnerHTML: { __html: renderMarkdown(data.ledger) } })
    ),

    // Refresh
    h('div', { style: { marginTop: 12, textAlign: 'center' as const } },
      h('button', {
        onClick: fetchProgress,
        style: {
          padding: '4px 12px', fontSize: 11,
          border: '1px solid #ddd', borderRadius: 4,
          background: '#fafafa', cursor: 'pointer',
        }
      }, '↻ Refresh')
    )
  )
}

// ── Title ──

function SddProgressTitle() {
  return h('span', null, 'SDD Progress')
}

// ── Tab definition ──

function sddProgressDefinition(): SidebarRightTabDefinition {
  return {
    id: TAB_ID,
    kind: TAB_KIND,
    priority: 'extension',
    title: () => 'SDD Progress',
    guide: [{
      order: 0,
      title: () => 'SDD Progress',
      description: () => 'View SDD task progress and ledger for the current session',
    }],
  }
}

// ── Plugin entry ──

export function apply(ctx: any): void {
  const disposeDefinition = ctx.sidebarRightTabs.register(sddProgressDefinition())

  const disposeBody = ctx.slots.inject('sidebar.right.pane.tab', () =>
    ctx.slots.register({
      name: 'sidebar.right.pane.tab',
      key: TAB_ID,
      inject: (sessionId: string) => ({ sessionId }),
    }, SddProgressBody)
  )

  const disposeTitle = ctx.slots.inject('sidebar.right.pane.tab.title', () =>
    ctx.slots.register({
      name: 'sidebar.right.pane.tab.title',
      key: TAB_ID,
    }, SddProgressTitle)
  )

  ctx.effect(() => {
    return () => {
      disposeTitle()
      disposeBody()
      disposeDefinition()
    }
  }, 'dsh-sdd-progress-xc: tab registration')
}
