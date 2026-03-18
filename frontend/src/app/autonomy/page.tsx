"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Bot,
  Play,
  Activity,
  DollarSign,
  Users,
  Database,
  Zap,
  TrendingUp,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Brain,
  Wrench,
  Eye,
  ChevronRight,
  Percent,
  FileText,
  Award,
  Terminal,
  Sparkles,
  Clock,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { PrivacyBadgeRow } from "@/components/ui/PrivacyBanner";
import type {
  AutonomyLog,
  DashboardMetrics,
  AgentCycleResult,
  AgentThought,
  AgentToolDef,
} from "@/lib/api";

// ─── Constants ──────────────────────────────────────────────────────────────

const TOOL_ICONS: Record<string, typeof Bot> = {
  onboard_mock_provider: Database,
  adjust_bonus: Award,
  adjust_platform_take: Percent,
  generate_monthly_report: FileText,
  analysis: Brain,
};

const TOOL_COLORS: Record<string, string> = {
  onboard_mock_provider: "text-emerald-400",
  adjust_bonus: "text-purple-400",
  adjust_platform_take: "text-amber-400",
  generate_monthly_report: "text-cyan-400",
  analysis: "text-gray-400",
};

const IMPACT_CONFIG: Record<string, { bg: string; text: string; border: string; icon: typeof ArrowUpRight; label: string }> = {
  positive: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", icon: ArrowUpRight, label: "Positive" },
  neutral: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", icon: Minus, label: "Neutral" },
  negative: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", icon: ArrowDownRight, label: "Negative" },
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  provider_onboard: "Provider Onboarded",
  bonus_adjustment: "Bonus Adjusted",
  take_rate_adjustment: "Take Rate Changed",
  monthly_report: "Report Generated",
  pricing_adjustment: "Pricing Adjusted",
  score_update: "Score Updated",
  status_report: "Status Report",
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function AutonomyDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [logs, setLogs] = useState<AutonomyLog[]>([]);
  const [agentTools, setAgentTools] = useState<AgentToolDef[]>([]);
  const [running, setRunning] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [lastCycle, setLastCycle] = useState<AgentCycleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [animatingStep, setAnimatingStep] = useState(-1);
  const [expandedThought, setExpandedThought] = useState<number | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [m, l, t] = await Promise.all([
        fetch("/api/autonomy/dashboard").then((r) => r.json()),
        fetch("/api/autonomy/logs?limit=50").then((r) => r.json()),
        fetch("/api/autonomy/tools").then((r) => r.json()),
      ]);
      setMetrics(m);
      setLogs(l);
      setAgentTools(t);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchData().then(() => setLoading(false));
  }, [fetchData]);

  const runCycle = useCallback(async () => {
    setRunning(true);
    setLastCycle(null);
    setAnimatingStep(0);
    setExpandedThought(null);

    try {
      const res = await fetch("/api/autonomy/run-cycle", { method: "POST" });
      const data: AgentCycleResult = await res.json();

      // Animate thoughts appearing one by one
      for (let i = 0; i < data.thoughts.length; i++) {
        setAnimatingStep(i);
        setLastCycle((prev) => ({
          ...data,
          thoughts: data.thoughts.slice(0, i + 1),
        }));
        // Stagger animation — 600ms per thought
        await new Promise((r) => setTimeout(r, 600));
      }

      setLastCycle(data);
      setAnimatingStep(-1);
      setCycleCount((c) => c + 1);
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  }, [fetchData]);

  // Auto-run cycles
  useEffect(() => {
    if (!autoRun) return;
    const interval = setInterval(runCycle, 6000);
    return () => clearInterval(interval);
  }, [autoRun, runCycle]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastCycle?.thoughts?.length]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-sm text-gray-500">Initializing Autonomy Agent...</p>
        </div>
      </div>
    );
  }

  const takeRate = metrics?.platform_take_rate ?? 30;
  const providerShare = 100 - takeRate;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 ring-1 ring-brand-500/30">
              <Bot className="h-5 w-5 text-brand-400" />
            </div>
            <h1 className="text-3xl font-bold">Autonomy Agent</h1>
            {autoRun && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                LIVE
              </span>
            )}
            {running && !autoRun && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-400 ring-1 ring-brand-500/20">
                <Loader2 className="h-3 w-3 animate-spin" />
                RUNNING
              </span>
            )}
          </div>
          <p className="text-gray-400 max-w-xl">
            ReAct-style AI agent that autonomously manages the marketplace — onboarding providers,
            adjusting bonuses, tuning take rates, and generating strategic reports.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runCycle}
            disabled={running}
            className="btn-primary text-base px-6 py-3"
          >
            {running ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            Run Agent Cycle
          </button>
          <button
            onClick={() => setAutoRun(!autoRun)}
            className={`px-4 py-3 rounded-xl font-medium transition-all ${
              autoRun
                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 hover:bg-emerald-500/30"
                : "btn-secondary"
            }`}
          >
            <RefreshCw className={`h-4 w-4 inline mr-2 ${autoRun ? "animate-spin" : ""}`} />
            {autoRun ? "Stop Auto" : "Auto-Pilot"}
          </button>
        </div>
      </div>

      <div className="mb-6"><PrivacyBadgeRow /></div>

      {/* Platform Stats Row */}
      {metrics && (
        <div className="mb-8 grid gap-4 grid-cols-2 lg:grid-cols-5">
          {[
            { icon: Database, label: "Active Providers", value: metrics.active_providers, sub: `${metrics.total_providers} total`, color: "text-blue-400", bg: "bg-blue-500/10" },
            { icon: Users, label: "Consumers", value: metrics.total_consumers, sub: "registered", color: "text-purple-400", bg: "bg-purple-500/10" },
            { icon: Zap, label: "Total Queries", value: formatNumber(metrics.total_queries), sub: `${metrics.avg_latency_ms}ms avg`, color: "text-cyan-400", bg: "bg-cyan-500/10" },
            { icon: DollarSign, label: "Total Revenue", value: formatCurrency(metrics.total_revenue), sub: `${formatCurrency(metrics.platform_earnings)} platform`, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { icon: Percent, label: "Take Rate", value: `${takeRate}%`, sub: `${providerShare}% to providers`, color: "text-amber-400", bg: "bg-amber-500/10" },
          ].map(({ icon: Icon, label, value, sub, color, bg }) => (
            <div key={label} className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</span>
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Revenue Split Bar */}
      {metrics && metrics.total_revenue > 0 && (
        <div className="mb-8 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-400">Revenue Distribution</h3>
            <span className="text-xs text-gray-500">
              Take rate: {takeRate}% platform / {providerShare}% providers
            </span>
          </div>
          <div className="flex h-10 overflow-hidden rounded-xl">
            <div
              className="flex items-center justify-center bg-gradient-to-r from-emerald-600 to-emerald-500 text-sm font-semibold transition-all duration-1000"
              style={{ width: `${providerShare}%` }}
            >
              Provider {providerShare}%
            </div>
            <div
              className="flex items-center justify-center bg-gradient-to-r from-brand-600 to-brand-500 text-sm font-semibold transition-all duration-1000"
              style={{ width: `${takeRate}%` }}
            >
              Platform {takeRate}%
            </div>
          </div>
          <div className="mt-3 flex justify-between text-sm">
            <span className="text-emerald-400">
              Provider Payouts: {formatCurrency(metrics.provider_payouts)}
            </span>
            <span className="text-brand-400">
              Platform Earnings: {formatCurrency(metrics.platform_earnings)}
            </span>
          </div>
        </div>
      )}

      {/* Agent Tools Panel */}
      {agentTools.length > 0 && (
        <div className="mb-8 glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="h-4 w-4 text-brand-400" />
            <h3 className="text-sm font-semibold text-gray-400">Agent Tool Registry</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {agentTools.map((tool) => {
              const ToolIcon = TOOL_ICONS[tool.name] || Wrench;
              const color = TOOL_COLORS[tool.name] || "text-gray-400";
              return (
                <div key={tool.name} className="rounded-xl bg-surface-200/30 p-4 ring-1 ring-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <ToolIcon className={`h-4 w-4 ${color}`} />
                    <span className="text-sm font-mono font-medium text-gray-200">
                      {tool.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{tool.description}</p>
                  {tool.parameters.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tool.parameters.map((p) => (
                        <span key={p} className="rounded bg-surface-300/50 px-1.5 py-0.5 text-[10px] font-mono text-gray-500">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content: Agent Reasoning + Activity Log */}
      <div className="grid gap-8 lg:grid-cols-5">
        {/* Left: Agent Reasoning Chain */}
        <div className="lg:col-span-3">
          <div className="glass-card">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-brand-400" />
                <h2 className="font-semibold">Agent Reasoning Chain</h2>
              </div>
              {lastCycle && (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-400 ring-1 ring-brand-500/20">
                    Cycle #{lastCycle.cycle_number}
                  </span>
                  <span className="text-xs text-gray-500">
                    {lastCycle.actions_taken} actions / {lastCycle.total_steps} steps
                  </span>
                </div>
              )}
            </div>

            <div className="max-h-[700px] overflow-y-auto p-4 space-y-1">
              {!lastCycle ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <Terminal className="h-12 w-12 mb-4 text-gray-700" />
                  <p className="text-sm font-medium mb-1">No agent cycle running</p>
                  <p className="text-xs text-gray-600">
                    Click &quot;Run Agent Cycle&quot; to watch the agent think and act
                  </p>
                </div>
              ) : (
                <>
                  {/* Cycle header */}
                  <div className="mb-4 rounded-xl bg-brand-500/5 border border-brand-500/10 p-4">
                    <div className="flex items-center gap-2 text-brand-400 mb-2">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        Agent Cycle #{lastCycle.cycle_number} Initiated
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono">
                      {lastCycle.started_at}
                    </p>
                  </div>

                  {/* Thought steps */}
                  {lastCycle.thoughts.map((thought, i) => (
                    <ThoughtStep
                      key={`${lastCycle.cycle_number}-${i}`}
                      thought={thought}
                      index={i}
                      isAnimating={animatingStep === i}
                      isExpanded={expandedThought === i}
                      onToggle={() =>
                        setExpandedThought(expandedThought === i ? null : i)
                      }
                    />
                  ))}

                  {/* Cycle summary */}
                  {!running && lastCycle.completed_at && (
                    <div className="mt-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                      <div className="flex items-center gap-2 text-emerald-400 mb-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">
                          Cycle Complete
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{lastCycle.summary}</p>
                      <p className="text-xs text-gray-500 font-mono mt-1">
                        {lastCycle.completed_at}
                      </p>
                    </div>
                  )}

                  <div ref={logEndRef} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Activity History Log */}
        <div className="lg:col-span-2">
          <div className="glass-card">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-brand-400" />
                <h2 className="font-semibold">Activity History</h2>
              </div>
              <span className="text-xs text-gray-500">{logs.length} entries</span>
            </div>
            <div className="max-h-[700px] overflow-y-auto p-3 space-y-2">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Clock className="h-8 w-8 mb-3 text-gray-700" />
                  <p className="text-sm">No activity yet</p>
                  <p className="text-xs text-gray-600">Run cycles to populate the log</p>
                </div>
              ) : (
                logs.map((log) => {
                  const LogIcon = TOOL_ICONS[log.action_type] || (
                    log.action_type === "pricing_adjustment" ? DollarSign
                    : log.action_type === "score_update" ? TrendingUp
                    : Bot
                  );
                  const impactCfg = IMPACT_CONFIG[log.impact] || IMPACT_CONFIG.neutral;

                  return (
                    <div
                      key={log.id}
                      className={`rounded-xl ${impactCfg.bg} border ${impactCfg.border} p-3 transition-all hover:brightness-110`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <LogIcon className={`h-3.5 w-3.5 ${impactCfg.text}`} />
                        <span className={`text-xs font-semibold ${impactCfg.text}`}>
                          {ACTION_TYPE_LABELS[log.action_type] || log.action_type}
                        </span>
                        <span className="ml-auto text-[10px] text-gray-600 font-mono">
                          #{log.cycle_number}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed break-words">
                        {log.description}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Thought Step Component ─────────────────────────────────────────────────

function ThoughtStep({
  thought,
  index,
  isAnimating,
  isExpanded,
  onToggle,
}: {
  thought: AgentThought;
  index: number;
  isAnimating: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const toolName = thought.tool || "analysis";
  const ToolIcon = TOOL_ICONS[toolName] || Brain;
  const toolColor = TOOL_COLORS[toolName] || "text-gray-400";
  const impactCfg = IMPACT_CONFIG[thought.impact] || IMPACT_CONFIG.neutral;
  const ImpactIcon = impactCfg.icon;

  return (
    <div
      className={`rounded-xl border transition-all duration-500 ${
        isAnimating
          ? "border-brand-500/30 bg-brand-500/5 animate-pulse"
          : `${impactCfg.border} ${impactCfg.bg}`
      }`}
    >
      {/* Clickable header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-start gap-3 text-left"
      >
        {/* Step indicator */}
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              thought.tool
                ? `${impactCfg.bg} ${impactCfg.text} ring-1 ${impactCfg.border}`
                : "bg-surface-200/50 text-gray-500"
            }`}
          >
            {index + 1}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Tool + impact badge row */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {thought.tool ? (
              <span className={`inline-flex items-center gap-1 rounded-md ${impactCfg.bg} px-2 py-0.5 text-xs font-mono font-medium ${impactCfg.text} ring-1 ${impactCfg.border}`}>
                <ToolIcon className="h-3 w-3" />
                {thought.tool}()
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-surface-200/50 px-2 py-0.5 text-xs font-mono text-gray-500">
                <Brain className="h-3 w-3" />
                reasoning
              </span>
            )}
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${impactCfg.text}`}>
              <ImpactIcon className="h-3 w-3" />
              {impactCfg.label}
            </span>
          </div>

          {/* Action summary (always visible) */}
          <p className="text-sm text-gray-300 leading-relaxed">
            {thought.action_taken || thought.thought.slice(0, 120) + "..."}
          </p>
        </div>

        {/* Expand chevron */}
        <ChevronRight
          className={`h-4 w-4 text-gray-600 mt-1 shrink-0 transition-transform ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 ml-9 space-y-3 border-t border-white/[0.04] mt-0">
          {/* Thought / Reasoning */}
          <div className="pt-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Brain className="h-3 w-3 text-brand-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                Thought
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed font-mono bg-surface-200/20 rounded-lg p-3">
              {thought.thought}
            </p>
          </div>

          {/* Tool call */}
          {thought.tool && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Wrench className="h-3 w-3 text-purple-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
                  Tool Call
                </span>
              </div>
              <div className="text-xs font-mono bg-surface-200/20 rounded-lg p-3">
                <span className={toolColor}>{thought.tool}</span>
                <span className="text-gray-500">(</span>
                {Object.keys(thought.tool_input).length > 0 ? (
                  <span className="text-gray-400">
                    {JSON.stringify(thought.tool_input)}
                  </span>
                ) : null}
                <span className="text-gray-500">)</span>
              </div>
            </div>
          )}

          {/* Observation */}
          {thought.observation && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Eye className="h-3 w-3 text-cyan-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                  Observation
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed bg-surface-200/20 rounded-lg p-3">
                {thought.observation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
