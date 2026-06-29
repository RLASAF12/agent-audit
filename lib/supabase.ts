import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Types ─────────────────────────────────────────────────────────────────

export type RiskTier = 'unacceptable' | 'high' | 'limited' | 'minimal'
export type DecisionType = 'tool_call' | 'response' | 'delegation' | 'refusal' | 'escalation'
export type AnnexIIICategory =
  | 'biometric'
  | 'critical_infrastructure'
  | 'education'
  | 'employment'
  | 'essential_services'
  | 'law_enforcement'
  | 'migration'
  | 'justice'
  | null

export interface AgentDecision {
  id: string
  created_at: string
  agent_id: string
  session_id: string
  decision_type: DecisionType
  tool_called: string | null
  input_hash: string
  input_summary: string | null
  output_summary: string
  involves_personal_data: boolean
  data_subjects_count: number
  affects_livelihood: boolean
  human_oversight_provided: boolean
  human_oversight_identity: string | null
  risk_tier: RiskTier
  annex_iii_category: AnnexIIICategory
  reasoning_captured: string | null
  confidence_score: number | null
  article_12_compliant: boolean
  compliance_notes: string | null
  sdk_version: string
  logged_from: string
}

export type NewDecision = Omit<AgentDecision, 'id' | 'created_at' | 'sdk_version' | 'article_12_compliant'>

// ─── Risk tier helpers ──────────────────────────────────────────────────────

export const RISK_CONFIG: Record<RiskTier, { label: string; color: string; bg: string; border: string; dot: string }> = {
  unacceptable: {
    label: 'Unacceptable',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-300',
    dot: 'bg-red-500',
  },
  high: {
    label: 'High Risk',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    dot: 'bg-orange-500',
  },
  limited: {
    label: 'Limited',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    dot: 'bg-yellow-500',
  },
  minimal: {
    label: 'Minimal',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-300',
    dot: 'bg-green-500',
  },
}

export const DECISION_ICONS: Record<DecisionType, string> = {
  tool_call: '🔧',
  response: '💬',
  delegation: '↗️',
  refusal: '🚫',
  escalation: '⚠️',
}

// ─── Hash helper (client-side SHA-256 via Web Crypto API) ──────────────────

export async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return 'sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

// ─── EU AI Act Article 12 evidence export ──────────────────────────────────

export function generateArticle12Export(decisions: AgentDecision[]) {
  const now = new Date().toISOString()
  const highRisk = decisions.filter(d => d.risk_tier === 'high' || d.risk_tier === 'unacceptable')
  const oversightGaps = highRisk.filter(d => !d.human_oversight_provided)

  return {
    export_metadata: {
      generated_at: now,
      regulation: 'EU AI Act (Regulation 2024/1689)',
      article: 'Article 12 — Transparency and provision of information to users',
      exported_by: 'AgentAudit v1.0.0',
      record_count: decisions.length,
      high_risk_count: highRisk.length,
      oversight_gap_count: oversightGaps.length,
      compliance_rate: decisions.length > 0
        ? `${Math.round((decisions.filter(d => d.article_12_compliant).length / decisions.length) * 100)}%`
        : 'N/A',
    },
    article_12_summary: {
      automatic_logging: true,
      log_includes_inputs: true,
      log_includes_outputs: true,
      log_includes_human_oversight: true,
      log_tamper_evident: true,
      retention_policy: 'Supabase persistent storage — 6 months minimum',
    },
    decisions: decisions.map(d => ({
      record_id: d.id,
      timestamp: d.created_at,
      agent_system: d.agent_id,
      session_reference: d.session_id,
      decision_type: d.decision_type,
      tool_invoked: d.tool_called,
      input_reference: d.input_hash,
      input_description: d.input_summary,
      output_description: d.output_summary,
      personal_data_processed: d.involves_personal_data,
      data_subjects_affected: d.data_subjects_count,
      affects_fundamental_rights: d.affects_livelihood,
      human_oversight_provided: d.human_oversight_provided,
      human_reviewer_identity: d.human_oversight_identity,
      risk_classification: d.risk_tier,
      annex_iii_category: d.annex_iii_category,
      decision_reasoning: d.reasoning_captured,
      confidence: d.confidence_score,
      article_12_compliant: d.article_12_compliant,
      compliance_notes: d.compliance_notes,
    })),
    oversight_gap_report: oversightGaps.map(d => ({
      record_id: d.id,
      timestamp: d.created_at,
      agent_system: d.agent_id,
      risk_tier: d.risk_tier,
      output_summary: d.output_summary,
      recommendation: 'This high-risk decision was made without documented human oversight. Review required before enforcement.',
    })),
  }
}
