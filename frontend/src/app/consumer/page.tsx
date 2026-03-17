"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap,
  Search,
  Play,
  DollarSign,
  Clock,
  Shield,
  ChevronDown,
  Loader2,
  Lock,
  Fingerprint,
  Wifi,
  WifiOff,
  ArrowRight,
  Route,
  FileCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useWebSocketMeter } from "@/lib/useWebSocketMeter";
import type { MCPTool, MCPQueryResponse, Consumer, MeterEvent } from "@/lib/api";

const EXAMPLE_QUERIES: Record<string, Record<string, unknown>> = {
  query_aggregate_claims: {
    diagnosis: "diabetes_t2",
    region: "northeast",
    date_range: "last_12m",
  },
  get_cost_trends: {
    procedure: "knee_replacement",
    time_window: "quarterly",
    plan_type: "commercial",
  },
  get_diabetes_claims_trends: {
    region: "northeast",
    time_period: "Q4-2025",
    metric: "cost_per_member",
  },
  get_cohort_cost_analysis: {
    diagnosis_group: "diabetes_t2",
    age_bracket: "50-64",
    plan_type: "commercial",
  },
  get_population_risk_stratification: {
    population_segment: "chronic_only",
    region: "national",
  },
  get_regional_trend_query: {
    state: "CA",
    service_type: "outpatient",
    year: 2025,
  },
  get_service_line_benchmarks: {
    service_line: "cardiology",
    facility_tier: "all",
  },
  get_drug_utilization_stats: {
    therapeutic_class: "antidiabetics",
    region: "northeast",
  },
  get_readmission_risk_scores: {
    condition: "chf",
    facility_type: "community_hospital",
  },
  get_telehealth_adoption_metrics: {
    specialty: "primary_care",
    demographic: "all",
  },
};

export default function ConsumerPortal() {
  const [catalog, setCatalog] = useState<MCPTool[]>([]);
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<MCPQueryResponse | null>(null);
  const [queryHistory, setQueryHistory] = useState<MCPQueryResponse[]>([]);
  const [liveEvents, setLiveEvents] = useState<MeterEvent[]>([]);
  const [executing, setExecuting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId] = useState(() => `sess_${Math.random().toString(36).slice(2, 14)}`);

  const { connected, lastEvent } = useWebSocketMeter();

  // Collect live transaction events from other users
  useEffect(() => {
    if (!lastEvent || lastEvent.type !== "transaction") return;
    setLiveEvents((prev) => [lastEvent, ...prev].slice(0, 30));
  }, [lastEvent]);

  useEffect(() => {
    Promise.all([
      fetch("/api/mcp/catalog").then((r) => r.json()),
      fetch("/api/consumers/").then((r) => r.json()),
    ])
      .then(([catalogData, consumersData]) => {
        setCatalog(catalogData);
        setConsumers(consumersData);
        if (catalogData.length > 0) setSelectedTool(catalogData[0]);
        if (consumersData.length > 0) setSelectedConsumer(consumersData[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedTool) {
      setParams(EXAMPLE_QUERIES[selectedTool.name] || {});
    }
  }, [selectedTool]);

  const executeQuery = useCallback(async () => {
    if (!selectedTool || !selectedConsumer) return;
    setExecuting(true);
    try {
      const res = await fetch("/api/mcp/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_name: selectedTool.name,
          consumer_id: selectedConsumer.id,
          parameters: params,
          session_id: sessionId,
        }),
      });
      const data: MCPQueryResponse = await res.json();
      setResult(data);
      setQueryHistory((prev) => [data, ...prev].slice(0, 20));

      // Refresh consumer data to show updated spend
      const updatedConsumer = await fetch(`/api/consumers/${selectedConsumer.id}`).then((r) => r.json());
      setSelectedConsumer(updatedConsumer);
      setConsumers((prev) => prev.map((c) => (c.id === updatedConsumer.id ? updatedConsumer : c)));
    } catch (err) {
      console.error(err);
    } finally {
      setExecuting(false);
    }
  }, [selectedTool, selectedConsumer, params, sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Zap className="h-7 w-7 text-brand-400" />
            <h1 className="text-3xl font-bold">Consumer Portal</h1>
          </div>
          <p className="text-gray-400">
            Browse the context catalog, run queries via MCP proxy, and see real-time cost breakdowns
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {connected ? (
            <span className="badge-green"><Wifi className="mr-1 inline h-3 w-3" />Live Meter</span>
          ) : (
            <span className="badge-yellow"><WifiOff className="mr-1 inline h-3 w-3" />Disconnected</span>
          )}
        </div>
      </div>

      {/* Privacy badges */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { icon: Shield, label: "PHI never leaves provider", color: "badge-green" },
          { icon: Lock, label: "HIPAA-aligned design", color: "badge-blue" },
          { icon: Fingerprint, label: "k-anonymized (k≥50)", color: "badge-purple" },
          { icon: FileCheck, label: "Aggregated data only", color: "badge-green" },
        ].map(({ icon: Icon, label, color }) => (
          <span key={label} className={color}>
            <Icon className="mr-1 inline h-3 w-3" />{label}
          </span>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Left: Consumer + Tool catalog */}
        <div className="lg:col-span-2 space-y-6">
          {/* Consumer selector with live spend */}
          <div className="glass-card p-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-500">
              Querying As
            </label>
            <div className="relative">
              <select
                value={selectedConsumer?.id || ""}
                onChange={(e) =>
                  setSelectedConsumer(consumers.find((c) => c.id === Number(e.target.value)) || null)
                }
                className="w-full appearance-none rounded-lg border border-white/10 bg-surface-200 px-4 py-2.5 pr-10 text-sm focus:border-brand-500 focus:outline-none"
              >
                {consumers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.organization})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
            </div>
            {selectedConsumer && (
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-gray-500">Total Spent: <span className="text-amber-400 font-semibold">{formatCurrency(selectedConsumer.total_spent)}</span></span>
                <span className="text-gray-500">Queries: <span className="text-brand-300 font-semibold">{selectedConsumer.query_count}</span></span>
                <span className="badge-blue">{selectedConsumer.plan}</span>
              </div>
            )}
            <p className="mt-2 text-[10px] text-gray-600 font-mono">Session: {sessionId}</p>
          </div>

          {/* Tool catalog */}
          <div className="glass-card">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
              <Search className="h-4 w-4 text-brand-400" />
              <h2 className="text-sm font-semibold">Context Catalog</h2>
              <span className="ml-auto text-xs text-gray-500">{catalog.length} tools</span>
            </div>
            <div className="max-h-[500px] overflow-y-auto p-2">
              {catalog.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(tool)}
                  className={`mb-1 w-full rounded-lg p-3 text-left transition-all ${
                    selectedTool?.id === tool.id
                      ? "bg-brand-600/15 border border-brand-500/30"
                      : "hover:bg-white/[0.03] border border-transparent"
                  }`}
                >
                  <p className="text-sm font-mono font-medium text-brand-300">{tool.name}</p>
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">{tool.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="badge-purple">{tool.category}</span>
                    <span className="text-emerald-400">{formatCurrency(tool.price_per_call)} base</span>
                    <span className="text-gray-600">{tool.call_count} calls</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Query builder + results */}
        <div className="lg:col-span-3 space-y-6">
          {/* Query builder */}
          {selectedTool && (
            <div className="glass-card">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
                <div className="flex items-center gap-2">
                  <Route className="h-4 w-4 text-brand-400" />
                  <h2 className="font-semibold">MCP Invoke</h2>
                </div>
                <span className="badge-green">{formatCurrency(selectedTool.price_per_call)} base/call</span>
              </div>
              <div className="p-6">
                <p className="mb-4 text-sm text-gray-400">{selectedTool.description}</p>

                {/* Cost preview */}
                <div className="mb-4 rounded-lg bg-surface-200/50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">
                    Estimated Cost
                  </p>
                  <div className="flex items-center gap-1 text-xs font-mono text-gray-400">
                    <span className="text-brand-300">${selectedTool.price_per_call.toFixed(4)}</span>
                    <span>×</span>
                    <span className="text-amber-400">
                      {(() => {
                        const n = Object.keys(params).length;
                        return n >= 4 ? "1.8x" : n === 3 ? "1.5x" : n === 2 ? "1.2x" : "1.0x";
                      })()}
                    </span>
                    <span className="text-gray-600">(complexity)</span>
                    <span>×</span>
                    <span className="text-cyan-400">
                      {(() => {
                        const qc = selectedConsumer?.query_count || 0;
                        return qc >= 10000 ? "0.85x" : qc >= 1000 ? "0.90x" : qc >= 100 ? "0.95x" : "1.00x";
                      })()}
                    </span>
                    <span className="text-gray-600">(volume)</span>
                    <span>=</span>
                    <span className="text-white font-bold">
                      ~${(() => {
                        const n = Object.keys(params).length;
                        const cm = n >= 4 ? 1.8 : n === 3 ? 1.5 : n === 2 ? 1.2 : 1.0;
                        const qc = selectedConsumer?.query_count || 0;
                        const vm = qc >= 10000 ? 0.85 : qc >= 1000 ? 0.90 : qc >= 100 ? 0.95 : 1.00;
                        return (selectedTool.price_per_call * cm * vm).toFixed(4);
                      })()}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-gray-500">
                    Parameters (JSON)
                  </label>
                  <textarea
                    value={JSON.stringify(params, null, 2)}
                    onChange={(e) => {
                      try {
                        setParams(JSON.parse(e.target.value));
                      } catch {
                        // invalid JSON, ignore
                      }
                    }}
                    rows={6}
                    className="w-full rounded-lg border border-white/10 bg-surface-200 px-4 py-3 font-mono text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={executeQuery}
                  disabled={executing}
                  className="btn-primary w-full justify-center disabled:opacity-50"
                >
                  {executing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                  {executing ? "Routing via MCP proxy..." : "Execute MCP Invoke"}
                </button>
              </div>
            </div>
          )}

          {/* Result with full math breakdown */}
          {result && (
            <div className="glass-card">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
                <h2 className="font-semibold">Query Result</h2>
                {result.session_id && (
                  <span className="text-[10px] font-mono text-gray-600">{result.session_id}</span>
                )}
              </div>
              <div className="p-6 space-y-4">
                {/* Top metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-surface-200/50 p-3 text-center">
                    <DollarSign className="mx-auto mb-1 h-4 w-4 text-emerald-400" />
                    <p className="text-lg font-bold">{formatCurrency(result.cost)}</p>
                    <p className="text-xs text-gray-500">Total Cost</p>
                  </div>
                  <div className="rounded-lg bg-surface-200/50 p-3 text-center">
                    <Clock className="mx-auto mb-1 h-4 w-4 text-brand-400" />
                    <p className="text-lg font-bold">{result.latency_ms}ms</p>
                    <p className="text-xs text-gray-500">Latency</p>
                  </div>
                  <div className="rounded-lg bg-surface-200/50 p-3 text-center">
                    <Shield className="mx-auto mb-1 h-4 w-4 text-purple-400" />
                    <p className="text-lg font-bold">0</p>
                    <p className="text-xs text-gray-500">PHI Records</p>
                  </div>
                </div>

                {/* Cost formula breakdown */}
                <div className="rounded-lg border border-white/[0.06] bg-surface-100 p-4">
                  <p className="text-xs font-semibold text-gray-300 mb-2">Cost Calculation</p>
                  <p className="text-xs font-mono text-gray-400">{result.cost_breakdown.formula}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded bg-surface-200/50 p-2 text-center">
                      <p className="text-gray-500">Base Price</p>
                      <p className="font-mono text-brand-300">${result.cost_breakdown.base_cost.toFixed(4)}</p>
                    </div>
                    <div className="rounded bg-surface-200/50 p-2 text-center">
                      <p className="text-gray-500">Complexity</p>
                      <p className="font-mono text-amber-400">{result.cost_breakdown.complexity_multiplier}x</p>
                    </div>
                    <div className="rounded bg-surface-200/50 p-2 text-center">
                      <p className="text-gray-500">Volume Discount</p>
                      <p className="font-mono text-cyan-400">{result.cost_breakdown.volume_multiplier}x</p>
                    </div>
                  </div>
                </div>

                {/* Reward formula breakdown */}
                <div className="rounded-lg border border-white/[0.06] bg-surface-100 p-4">
                  <p className="text-xs font-semibold text-gray-300 mb-2">Revenue Split</p>
                  <p className="text-xs font-mono text-gray-400">{result.reward_breakdown.formula}</p>
                  <div className="mt-2 flex gap-2">
                    <div className="flex-1 rounded bg-emerald-500/5 p-3 text-center">
                      <p className="text-xs text-gray-400">Provider</p>
                      <p className="text-sm font-bold text-emerald-400">
                        {formatCurrency(result.reward_breakdown.total_provider_payout)}
                      </p>
                      <div className="mt-1 text-[10px] text-gray-500 space-y-0.5">
                        <p>Base 70%: {formatCurrency(result.reward_breakdown.provider_base_payout)}</p>
                        {result.reward_breakdown.uptime_bonus > 0 && (
                          <p className="text-emerald-500">+Uptime: {formatCurrency(result.reward_breakdown.uptime_bonus)}</p>
                        )}
                        {result.reward_breakdown.quality_bonus > 0 && (
                          <p className="text-emerald-500">+Quality: {formatCurrency(result.reward_breakdown.quality_bonus)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 rounded bg-brand-500/5 p-3 text-center">
                      <p className="text-xs text-gray-400">Platform</p>
                      <p className="text-sm font-bold text-brand-400">
                        {formatCurrency(result.reward_breakdown.platform_fee)}
                      </p>
                      <p className="mt-1 text-[10px] text-gray-500">
                        {((result.reward_breakdown.platform_fee / result.cost) * 100).toFixed(1)}% effective rate
                      </p>
                    </div>
                  </div>
                </div>

                {/* Transaction flow visualization */}
                <div className="flex items-center justify-center gap-2 text-xs py-2">
                  <span className="badge-blue">You</span>
                  <ArrowRight className="h-3 w-3 text-gray-500" />
                  <span className="font-mono text-white">${result.cost.toFixed(4)}</span>
                  <ArrowRight className="h-3 w-3 text-gray-500" />
                  <span className="badge-purple">ContextRx Proxy</span>
                  <ArrowRight className="h-3 w-3 text-gray-500" />
                  <span className="font-mono text-emerald-400">${result.reward_breakdown.total_provider_payout.toFixed(4)}</span>
                  <ArrowRight className="h-3 w-3 text-gray-500" />
                  <span className="badge-green">Provider</span>
                </div>

                {/* Routing info */}
                <div className="rounded bg-surface-200/30 px-3 py-2 text-xs text-gray-500 font-mono">
                  <Route className="inline h-3 w-3 mr-1" />
                  Routed to: {result.routed_to}
                </div>

                {/* Raw result */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                    Response Data
                  </p>
                  <pre className="max-h-[300px] overflow-auto rounded-lg bg-surface-200 p-4 text-xs font-mono text-gray-300">
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                </div>

                {/* Privacy badges */}
                <div className="flex flex-wrap gap-2">
                  {(result.privacy_badges || []).map((badge) => (
                    <span key={badge} className="badge-green">
                      <Shield className="mr-1 inline h-3 w-3" />{badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Query history */}
          {queryHistory.length > 0 && (
            <div className="glass-card">
              <div className="border-b border-white/[0.06] px-6 py-4">
                <h2 className="text-sm font-semibold">Query History ({queryHistory.length})</h2>
              </div>
              <div className="max-h-[250px] overflow-y-auto p-4 space-y-2">
                {queryHistory.map((q, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-surface-200/30 px-4 py-2"
                  >
                    <div>
                      <span className="text-sm font-mono text-brand-300">{q.tool_name}</span>
                      <p className="text-[10px] text-gray-600 font-mono mt-0.5">
                        {q.cost_breakdown.base_cost.toFixed(4)} × {q.cost_breakdown.complexity_multiplier}x × {q.cost_breakdown.volume_multiplier}x
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{q.latency_ms}ms</span>
                      <span className="font-semibold text-emerald-400">{formatCurrency(q.cost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live meter feed */}
          {liveEvents.length > 0 && (
            <div className="glass-card">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-6 py-4">
                <Wifi className="h-4 w-4 text-emerald-400 animate-pulse" />
                <h2 className="text-sm font-semibold">Live Transaction Feed</h2>
              </div>
              <div className="max-h-[200px] overflow-y-auto p-4 space-y-2">
                {liveEvents.map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-surface-200/20 px-4 py-2 text-xs"
                  >
                    <div>
                      <span className="font-mono text-brand-300">{ev.tool_name}</span>
                      <span className="ml-2 text-gray-500">{ev.consumer_name} → {ev.provider_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{ev.latency_ms}ms</span>
                      <span className="font-semibold text-emerald-400">
                        ${ev.cost_breakdown?.final_cost?.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
