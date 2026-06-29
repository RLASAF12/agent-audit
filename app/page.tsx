'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, AgentDecision, RISK_CONFIG, DECISION_ICONS, hashText, generateArticle12Export, RiskTier, DecisionType } from '@/lib/supabase'
import { format, formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

// ─── Stats Bar ──────────────────────────────────────────────────────────────

function StatsBar({ decisions }: { decisions: AgentDecision[] }) {
  const total = decisions.length
  const highRisk = decisions.filter(d => d.risk_tier === 'high' || d.risk_tier === 'unacceptable').length
  const oversightGaps = decisions.filter(d =>
    (d.risk_tier === 'high' || d.risk_tier === 'unacceptable') && !d.human_oversight_provided
  ).length
  const compliant = decisions.filter(d => d.article_12_compliant).length
  const rate = total > 0 ? Math.round((compliant / total) * 100) : 100

  const daysLeft = Math.ceil((new Date('2026-08-02').getTime() - Date.now()) / 86400000)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {[
        { label: 'Total Decisions', value: total, sub: 'session log', color: 'text-slate-700' },
        { label: 'High Risk', value: highRisk, sub: 'Annex III flagged', color: 'text-orange-600' },
        { label: 'Oversight Gaps', value: oversightGaps, sub: 'need human review', color: oversightGaps > 0 ? 'text-red-600' : 'text-green-600' },
        { label: 'Article 12 Rate', value: `${rate}%`, sub: 'compliant decisions', color: rate === 100 ? 'text-green-600' : rate > 80 ? 'text-yellow-600' : 'text-red-600' },
        { label: 'EU Act Deadline', value: `${daysLeft}d`, sub: 'Aug 2, 2026', color: daysLeft < 60 ? 'text-red-600' : 'text-slate-700' },
      ].map(stat => (
        <div key={stat.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <div className={clsx('text-2xl font-bold', stat.color)}>{stat.value}</div>
          <div className="text-xs font-medium text-slate-600 mt-0.5">{stat.label}</div>
          <div className="text-xs text-slate-400">{stat.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Risk Badge ─────────────────────────────────────────────────────────────

function RiskBadge({ tier }: { tier: RiskTier }) {
  const cfg = RISK_CONFIG[tier]
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border',
      cfg.bg, cfg.color, cfg.border
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

// ─── Decision Row ────────────────────────────────────────────────────────────

function DecisionRow({ decision, isNew }: { decision: AgentDecision; isNew: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = RISK_CONFIG[decision.risk_tier]

  return (
    <>
      <tr
        onClick={() => setExpanded(e => !e)}
        className={clsx(
          'cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100',
          isNew && 'animate-pulse-once',
          decision.risk_tier === 'unacceptable' && 'bg-red-50/40',
        )}
      >
        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
          {formatDistanceToNow(new Date(decision.created_at), { addSuffix: true })}
        </td>
        <td className="px-4 py-3">
          <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">
            {decision.agent_id}
          </span>
        </td>
        <td className="px-4 py-3 text-sm">
          <span className="mr-1">{DECISION_ICONS[decision.decision_type]}</span>
          <span className="capitalize text-slate-600">{decision.decision_type.replace('_', ' ')}</span>
          {decision.tool_called && (
            <span className="ml-1 text-xs text-slate-400">→ {decision.tool_called}</span>
          )}
        </td>
        <td className="px-4 py-3 max-w-xs">
          <p className="text-sm text-slate-700 truncate">{decision.output_summary}</p>
        </td>
        <td className="px-4 py-3">
          <RiskBadge tier={decision.risk_tier} />
        </td>
        <td className="px-4 py-3 text-center">
          {decision.involves_personal_data
            ? <span title="Personal data processed" className="text-orange-500 text-sm">👤</span>
            : <span className="text-slate-300 text-sm">—</span>}
        </td>
        <td className="px-4 py-3 text-center">
          {decision.human_oversight_provided
            ? <span title="Human oversight provided" className="text-green-500 text-sm">✓</span>
            : (decision.risk_tier === 'high' || decision.risk_tier === 'unacceptable')
              ? <span title="⚠ High-risk with no oversight" className="text-red-500 font-bold text-sm">✗</span>
              : <span className="text-slate-300 text-sm">—</span>}
        </td>
        <td className="px-4 py-3 text-center">
          <span className={clsx(
            'text-xs',
            decision.article_12_compliant ? 'text-green-600' : 'text-red-600'
          )}>
            {decision.article_12_compliant ? '✓' : '✗'}
          </span>
        </td>
      </tr>

      {expanded && (
        <tr className={clsx('animate-fade-in border-b border-slate-200', cfg.bg)}>
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">📋 EU AI Act Article 12 Record</h4>
                <dl className="space-y-1 text-xs">
                  <div className="flex gap-2"><dt className="text-slate-500 w-28">Record ID</dt><dd className="font-mono text-slate-700">{decision.id.slice(0, 8)}…</dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-28">Timestamp</dt><dd>{format(new Date(decision.created_at), 'yyyy-MM-dd HH:mm:ss zzz')}</dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-28">Input Hash</dt><dd className="font-mono">{decision.input_hash}</dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-28">Session</dt><dd className="font-mono">{decision.session_id}</dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-28">SDK Version</dt><dd>{decision.sdk_version}</dd></div>
                </dl>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">⚖️ Risk & Oversight</h4>
                <dl className="space-y-1 text-xs">
                  <div className="flex gap-2"><dt className="text-slate-500 w-28">Risk Tier</dt><dd><RiskBadge tier={decision.risk_tier} /></dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-28">Annex III</dt><dd>{decision.annex_iii_category ?? 'Not applicable'}</dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-28">Personal Data</dt><dd>{decision.involves_personal_data ? `Yes — ${decision.data_subjects_count} subject(s)` : 'No'}</dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-28">Affects Rights</dt><dd>{decision.affects_livelihood ? 'Yes ⚠️' : 'No'}</dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-28">Human Review</dt><dd>{decision.human_oversight_provided ? (decision.human_oversight_identity ?? 'Yes') : 'Not provided'}</dd></div>
                  <div className="flex gap-2"><dt className="text-slate-500 w-28">Confidence</dt><dd>{decision.confidence_score != null ? `${Math.round(decision.confidence_score * 100)}%` : '—'}</dd></div>
                </dl>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">💭 Art. 13 Reasoning</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {decision.reasoning_captured ?? 'No reasoning captured for this decision.'}
                </p>
                {decision.input_summary && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-slate-500">Input context:</span>
                    <p className="text-xs text-slate-500 mt-0.5">{decision.input_summary}</p>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Demo Panel ──────────────────────────────────────────────────────────────

function DemoPanel({ onLog }: { onLog: () => void }) {
  const [agentId, setAgentId] = useState('my-agent-v1')
  const [outputSummary, setOutputSummary] = useState('')
  const [riskTier, setRiskTier] = useState<RiskTier>('minimal')
  const [decisionType, setDecisionType] = useState<DecisionType>('tool_call')
  const [toolCalled, setToolCalled] = useState('')
  const [personalData, setPersonalData] = useState(false)
  const [subjects, setSubjects] = useState(0)
  const [affectsLivelihood, setAffectsLivelihood] = useState(false)
  const [oversight, setOversight] = useState(false)
  const [reasoning, setReasoning] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!outputSummary.trim()) return

    setLoading(true)
    try {
      const inputHash = await hashText(outputSummary + Date.now())
      const { error } = await supabase.from('agent_decisions').insert({
        agent_id: agentId || 'demo-agent',
        session_id: 'sess_demo_live',
        decision_type: decisionType,
        tool_called: toolCalled || null,
        input_hash: inputHash,
        input_summary: 'Live demo input',
        output_summary: outputSummary,
        involves_personal_data: personalData,
        data_subjects_count: personalData ? subjects : 0,
        affects_livelihood: affectsLivelihood,
        human_oversight_provided: oversight,
        human_oversight_identity: oversight ? 'Demo reviewer' : null,
        risk_tier: riskTier,
        annex_iii_category: null,
        reasoning_captured: reasoning || null,
        confidence_score: 0.80,
        article_12_compliant: true,
        logged_from: 'demo',
      })

      if (!error) {
        setSuccess(true)
        setOutputSummary('')
        setReasoning('')
        onLog()
        setTimeout(() => setSuccess(false), 2000)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <h3 className="font-semibold text-slate-800">Log an Agent Decision</h3>
        <span className="ml-auto text-xs text-slate-400">Live demo</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Agent ID</label>
            <input
              value={agentId}
              onChange={e => setAgentId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="my-agent-v1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Decision Type</label>
            <select
              value={decisionType}
              onChange={e => setDecisionType(e.target.value as DecisionType)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(['tool_call', 'response', 'delegation', 'refusal', 'escalation'] as DecisionType[]).map(t => (
                <option key={t} value={t}>{DECISION_ICONS[t]} {t.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {decisionType === 'tool_call' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tool Called</label>
            <input
              value={toolCalled}
              onChange={e => setToolCalled(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. rank_candidates, fetch_credit_score"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Decision Output Summary *</label>
          <textarea
            value={outputSummary}
            onChange={e => setOutputSummary(e.target.value)}
            required
            rows={2}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="What did the agent decide or output?"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Risk Classification (EU AI Act Annex III)</label>
          <div className="grid grid-cols-4 gap-1">
            {(['minimal', 'limited', 'high', 'unacceptable'] as RiskTier[]).map(tier => {
              const cfg = RISK_CONFIG[tier]
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setRiskTier(tier)}
                  className={clsx(
                    'text-xs py-1.5 px-2 rounded-lg border transition-all font-medium',
                    riskTier === tier
                      ? clsx(cfg.bg, cfg.color, cfg.border, 'ring-2 ring-offset-1', tier === 'unacceptable' ? 'ring-red-400' : tier === 'high' ? 'ring-orange-400' : tier === 'limited' ? 'ring-yellow-400' : 'ring-green-400')
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  )}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Article 13 Reasoning (optional)</label>
          <input
            value={reasoning}
            onChange={e => setReasoning(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Why did the agent make this decision?"
          />
        </div>

        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={personalData} onChange={e => setPersonalData(e.target.checked)}
              className="rounded accent-orange-500" />
            <span className="text-slate-700">Personal data processed</span>
            {personalData && (
              <input type="number" value={subjects} onChange={e => setSubjects(Number(e.target.value))}
                min={0} className="ml-auto w-16 text-xs border border-slate-200 rounded px-2 py-1" placeholder="# subjects" />
            )}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={affectsLivelihood} onChange={e => setAffectsLivelihood(e.target.checked)}
              className="rounded accent-red-500" />
            <span className="text-slate-700">Affects fundamental rights / livelihood</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={oversight} onChange={e => setOversight(e.target.checked)}
              className="rounded accent-green-500" />
            <span className="text-slate-700">Human oversight provided</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !outputSummary.trim()}
          className={clsx(
            'w-full py-2.5 rounded-lg text-sm font-semibold transition-all',
            success
              ? 'bg-green-500 text-white'
              : loading
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-[#003399] hover:bg-blue-800 text-white active:scale-[0.98]'
          )}
        >
          {success ? '✓ Logged to Article 12 trail' : loading ? 'Logging…' : '🔏 Log Decision'}
        </button>
      </form>
    </div>
  )
}

// ─── Export Button ────────────────────────────────────────────────────────────

function ExportButton({ decisions }: { decisions: AgentDecision[] }) {
  const handleExport = () => {
    const data = generateArticle12Export(decisions)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `eu-ai-act-evidence-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={decisions.length === 0}
      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-40"
    >
      <span>📄</span>
      Export EU AI Act Evidence Package
    </button>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [decisions, setDecisions] = useState<AgentDecision[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RiskTier | 'all'>('all')
  const [liveCount, setLiveCount] = useState(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Initial fetch
  useEffect(() => {
    supabase
      .from('agent_decisions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setDecisions(data as AgentDecision[])
        setLoading(false)
      })
  }, [])

  // Realtime subscription
  useEffect(() => {
    channelRef.current = supabase
      .channel('agent-decisions-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_decisions' },
        (payload) => {
          const newDecision = payload.new as AgentDecision
          setDecisions(prev => [newDecision, ...prev])
          setNewIds(prev => new Set([...prev, newDecision.id]))
          setLiveCount(c => c + 1)
          setTimeout(() => {
            setNewIds(prev => {
              const next = new Set(prev)
              next.delete(newDecision.id)
              return next
            })
          }, 2000)
        }
      )
      .subscribe()

    return () => {
      channelRef.current?.unsubscribe()
    }
  }, [])

  const filtered = filter === 'all' ? decisions : decisions.filter(d => d.risk_tier === filter)

  const handleLog = useCallback(() => {}, [])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[#003399] text-white px-6 py-4 shadow-lg">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#FFCC00] rounded-md flex items-center justify-center text-[#003399] font-black text-sm">A</div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">AgentAudit</h1>
              <p className="text-xs text-blue-200">EU AI Act Article 12 · Real-time Decision Trail</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {liveCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs bg-white/10 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                {liveCount} live since load
              </span>
            )}
            <span className="text-xs text-blue-200 border border-blue-400/40 px-3 py-1.5 rounded-full">
              🗓 High-risk deadline: Aug 2, 2026
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 sm:px-6 py-6">
        <StatsBar decisions={decisions} />

        <div className="flex flex-col xl:flex-row gap-6">
          {/* Main Table */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">Decision Trail</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{filtered.length}</span>
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    live
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex gap-1">
                    {(['all', 'unacceptable', 'high', 'limited', 'minimal'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={clsx(
                          'text-xs px-2.5 py-1 rounded-lg border transition-all',
                          filter === f
                            ? f === 'all' ? 'bg-slate-800 text-white border-slate-800' : clsx(RISK_CONFIG[f as RiskTier]?.bg, RISK_CONFIG[f as RiskTier]?.color, RISK_CONFIG[f as RiskTier]?.border)
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        )}
                      >
                        {f === 'all' ? 'All' : RISK_CONFIG[f as RiskTier].label}
                      </button>
                    ))}
                  </div>
                  <ExportButton decisions={decisions} />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                  Loading audit trail…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <span className="text-3xl mb-2">🔍</span>
                  <p className="text-sm">No decisions logged yet. Use the panel to log your first decision.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50/60">
                        <th className="px-4 py-2.5 text-left font-medium">Time</th>
                        <th className="px-4 py-2.5 text-left font-medium">Agent</th>
                        <th className="px-4 py-2.5 text-left font-medium">Type</th>
                        <th className="px-4 py-2.5 text-left font-medium">Output</th>
                        <th className="px-4 py-2.5 text-left font-medium">Risk</th>
                        <th className="px-4 py-2.5 text-center font-medium" title="Personal Data">PII</th>
                        <th className="px-4 py-2.5 text-center font-medium" title="Human Oversight">HO</th>
                        <th className="px-4 py-2.5 text-center font-medium" title="Article 12 Compliant">Art.12</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(d => (
                        <DecisionRow key={d.id} decision={d} isNew={newIds.has(d.id)} />
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-400 text-center py-2 border-t border-slate-100">
                    Click any row to expand Article 12 fields · Live via Supabase Realtime
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Side Panel */}
          <div className="xl:w-80 shrink-0 space-y-4">
            <DemoPanel onLog={handleLog} />

            {/* Article 12 info card */}
            <div className="bg-[#003399]/5 border border-[#003399]/15 rounded-xl p-4">
              <h4 className="text-xs font-bold text-[#003399] uppercase tracking-wide mb-2">EU AI Act Art. 12</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                High-risk AI systems must automatically log events to identify risks and ensure full traceability. Logs must be <strong>tamper-evident</strong> and retained for at least <strong>6 months</strong>.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-500">
                {[
                  '✓ Input captured (hash)',
                  '✓ Output recorded',
                  '✓ Human oversight tracked',
                  '✓ Risk classification logged',
                  '✓ Reasoning captured (Art. 13)',
                  '✓ Exportable evidence pack',
                ].map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-400">
                Enforcement begins <span className="font-semibold text-red-600">August 2, 2026</span>.
              </p>
            </div>

            {/* SDK snippet */}
            <div className="bg-slate-900 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-400 mb-2">Quick integration (2 lines)</p>
              <pre className="text-xs text-green-400 leading-relaxed whitespace-pre-wrap overflow-x-auto">{`import { logDecision } from 'agent-audit-sdk'

// In your agent's tool call handler:
await logDecision({
  agent_id: 'my-hiring-agent',
  decision_type: 'tool_call',
  tool_called: 'rank_candidates',
  output_summary: result.summary,
  risk_tier: 'high',
  involves_personal_data: true,
})`}</pre>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-400">
        AgentAudit v1.0.0 · Built by{' '}
        <a href="https://harelasaf.com" target="_blank" rel="noopener" className="text-[#003399] hover:underline">
          Harel Asaf
        </a>{' '}
        · EU AI Act Article 12 compliant logging · Supabase Realtime
      </footer>
    </div>
  )
}
