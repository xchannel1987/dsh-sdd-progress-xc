/**
 * dsh-sdd-progress-xc — browser half.
 *
 * Registers a right-sidebar tab showing SDD task progress + ledger.
 */
import { useState, useEffect, useCallback, useMemo, createElement as h } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
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

type SddTab = 'tasks' | 'ledger'

function SddProgressBody({ sessionId }: { sessionId?: string }) {
  const [data, setData] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SddTab>('tasks')
  const codeLabels = useMemo(() => ({ copyLabel: '复制', copiedLabel: '已复制' }), [])

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

  const tabBtn = function (tab: SddTab, label: string) {
    const isActive = activeTab === tab
    return h('button', {
      key: tab,
      onClick: () => setActiveTab(tab),
      style: {
        padding: '5px 12px',
        fontSize: 12,
        cursor: 'pointer',
        border: 'none',
        background: isActive ? '#eef2ff' : 'transparent',
        color: isActive ? '#4f7cff' : '#666',
        fontWeight: isActive ? 600 : 400,
        borderRadius: '5px 5px 0 0',
        marginRight: 2,
      },
    }, label)
  }

  return h('div', { style: { padding: 12, overflow: 'auto', fontSize: 13, lineHeight: 1.5, height: '100%', display: 'flex', flexDirection: 'column' as const } },
    // Header with refresh button on the right
    h('div', {
      style: { marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'flex-start', gap: 8 },
    },
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { style: { fontSize: 11, color: '#999', marginBottom: 4, wordBreak: 'break-all' as const } },
          'Requirement: ' + (data.requirementName || 'unknown')
        ),
        h('div', { style: { fontSize: 11, color: '#999', wordBreak: 'break-all' as const } },
          'Session: ' + (data.sessionId || 'unknown').slice(0, 12) + '...'
        ),
      ),
      h('button', { onClick: fetchProgress, title: 'Refresh tasks and ledger',
        style: { flexShrink: 0, padding: '3px 10px', fontSize: 11, lineHeight: '16px',
          border: '1px solid #ddd', borderRadius: 4, background: '#fafafa', cursor: 'pointer', color: '#555' },
      }, '↻ Refresh'),
    ),

    // Tab bar
    h('div', { style: { display: 'flex', marginBottom: 10, borderBottom: '1px solid #e5e5e5' } },
      tabBtn('tasks', 'Tasks'),
      tabBtn('ledger', 'Progress Ledger'),
    ),

    // Content area by tab
    activeTab === 'tasks' && h('div', { style: { flex: 1, overflow: 'auto' } },
      h('div', { style: { display: 'flex', gap: 8, marginBottom: 8, fontSize: 12 } },
        h('span', { style: { color: '#2e7d32' } }, '✓ ' + done),
        h('span', { style: { color: '#e65100' } }, '⏳ ' + active),
        h('span', { style: { color: '#757575' } }, '○ ' + pending),
        h('span', { style: { color: '#999' } }, '/ ' + todos.length + ' total'),
      ),
      todos.length > 0
        ? todos.map((t, i) =>
            h('div', { key: i, style: { padding: '5px 8px', marginBottom: 3, background: statusBg(t.status),
              borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 6 } },
              h('span', { style: { color: statusFg(t.status), flexShrink: 0 } }, statusIcon(t.status)),
              h('span', { style: { color: t.status === 'completed' ? '#999' : '#333', textDecoration: t.status === 'completed' ? 'line-through' : 'none' } }, t.content),
            )
          )
        : h('div', { style: { color: '#999', fontSize: 12, padding: '8px 0' } }, 'No tasks yet'),
    ),

    activeTab === 'ledger' && h('div', { style: { flex: 1, overflow: 'auto' } },
      data.ledger
        ? h(MarkdownText, { text: data.ledger, streaming: false, codeLabels })
        : h('div', { style: { color: '#999', fontSize: 12, padding: '8px 0' } }, 'No progress ledger found'),
    ),
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