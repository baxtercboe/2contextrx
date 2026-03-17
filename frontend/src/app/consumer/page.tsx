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
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { MCPTool, MCPQueryResponse, Consumer } from "@/lib/api";

const EXAMPLE_QUERIES: Record<string, Record<string, unknown>> = {
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
  get_regional_trend_query: {
    state: "CA",
    service_type: "outpatient",
    year: 2025,
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
  const [executing, setExecuting] = useState(false);
  const [loading, setLoading] = useState(true);

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
      const res = await fetch("/api/mcp/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_name: selectedTool.name,
          consumer_id: selectedConsumer.id,
          parameters: params,
        }),
      });
      const data: MCPQueryResponse = await res.json();
      setResult(data);
      setQueryHistory((prev) => [data, ...prev].slice(0, 20));
    } catch (err) {
      console.error(err);
    } finally {
      setExecuting(false);
    }
  }, [selectedTool, selectedConsumer, params]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="h-7 w-7 text-brand-400" />
          <h1 className="text-3xl font-bold">Consumer Portal</h1>
        </div>
        <p className="text-gray-400">
          Browse the context catalog, run queries, and see real-time cost breakdowns
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Left: Tool catalog + query builder */}
        <div className="lg:col-span-2 space-y-6">
          {/* Consumer selector */}
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
          </div>

          {/* Tool catalog */}
          <div className="glass-card">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
              <Search className="h-4 w-4 text-brand-400" />
              <h2 className="text-sm font-semibold">Context Catalog</h2>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-2">
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
                    <span className="text-emerald-400">{formatCurrency(tool.price_per_call)}/call</span>
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
                <h2 className="font-semibold">Query Builder</h2>
                <span className="badge-green">{formatCurrency(selectedTool.price_per_call)}/call</span>
              </div>
              <div className="p-6">
                <p className="mb-4 text-sm text-gray-400">{selectedTool.description}</p>

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
                  {executing ? "Executing..." : "Execute MCP Query"}
                </button>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="glass-card">
              <div className="border-b border-white/[0.06] px-6 py-4">
                <h2 className="font-semibold">Query Result</h2>
              </div>
              <div className="p-6 space-y-4">
                {/* Cost breakdown */}
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

                {/* Revenue split */}
                <div className="flex gap-4 text-xs">
                  <div className="flex-1 rounded-lg bg-emerald-500/5 p-3 text-center">
                    <p className="text-gray-400">Provider (70%)</p>
                    <p className="mt-1 font-semibold text-emerald-400">
                      {formatCurrency(result.provider_payout)}
                    </p>
                  </div>
                  <div className="flex-1 rounded-lg bg-brand-500/5 p-3 text-center">
                    <p className="text-gray-400">Platform (30%)</p>
                    <p className="mt-1 font-semibold text-brand-400">
                      {formatCurrency(result.platform_fee)}
                    </p>
                  </div>
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

                {/* PHI disclaimer */}
                <div className="flex items-start gap-2 rounded-lg bg-emerald-500/5 p-3 text-xs text-emerald-400">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                  {result.phi_disclaimer}
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
              <div className="max-h-[200px] overflow-y-auto p-4 space-y-2">
                {queryHistory.map((q, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-surface-200/30 px-4 py-2"
                  >
                    <span className="text-sm font-mono text-brand-300">{q.tool_name}</span>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{q.latency_ms}ms</span>
                      <span className="font-semibold text-emerald-400">{formatCurrency(q.cost)}</span>
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
