"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Zap,
  Search,
  Play,
  DollarSign,
  Clock,
  Shield,
  ChevronDown,
  Loader2,
  Wifi,
  WifiOff,
  ArrowRight,
  Route,
  CheckCircle2,
  Copy,
  Receipt,
  History,
  Layers,
  Tag,
  X,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useWebSocketMeter } from "@/lib/useWebSocketMeter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Input, Textarea } from "@/components/ui/Input";
import { PrivacyBadgeRow, PrivacyBanner } from "@/components/ui/PrivacyBanner";
import type { MCPTool, MCPQueryResponse, Consumer, MeterEvent, Transaction } from "@/lib/api";

const EXAMPLE_QUERIES: Record<string, { params: Record<string, unknown>; label: string }> = {
  query_aggregate_claims: { params: { diagnosis: "diabetes_t2", region: "northeast", date_range: "last_12m" }, label: "Diabetes Claims (NE)" },
  get_cost_trends: { params: { procedure: "knee_replacement", time_window: "quarterly", plan_type: "commercial" }, label: "Knee Replacement Costs" },
  get_diabetes_claims_trends: { params: { region: "southeast", time_period: "Q4-2025", metric: "cost_per_member" }, label: "Diabetes Trends (SE)" },
  get_cohort_cost_analysis: { params: { diagnosis_group: "chf", age_bracket: "65+", plan_type: "medicare" }, label: "CHF Medicare Cohort" },
  get_population_risk_stratification: { params: { population_segment: "high_utilizers", region: "national" }, label: "High Utilizer Risk" },
  get_regional_trend_query: { params: { state: "TX", service_type: "emergency", year: 2025 }, label: "TX Emergency Trends" },
  get_service_line_benchmarks: { params: { service_line: "cardiology", facility_tier: "all" }, label: "Cardiology Benchmarks" },
  get_drug_utilization_stats: { params: { therapeutic_class: "antidiabetics", region: "midwest" }, label: "Antidiabetic Utilization" },
  get_readmission_risk_scores: { params: { condition: "chf", facility_type: "community_hospital" }, label: "CHF Readmission Risk" },
  get_telehealth_adoption_metrics: { params: { specialty: "behavioral_health", demographic: "rural" }, label: "Rural Telehealth" },
};

export default function ConsumerPortal() {
  const searchParams = useSearchParams();
  const justOnboarded = searchParams.get("onboarded") === "true";

  const [catalog, setCatalog] = useState<MCPTool[]>([]);
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(null);
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<MCPQueryResponse | null>(null);
  const [queryHistory, setQueryHistory] = useState<MCPQueryResponse[]>([]);
  const [liveEvents, setLiveEvents] = useState<MeterEvent[]>([]);
  const [usageHistory, setUsageHistory] = useState<Transaction[]>([]);
  const [executing, setExecuting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOnboardBanner, setShowOnboardBanner] = useState(justOnboarded);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [sessionId] = useState(() => `sess_${Math.random().toString(36).slice(2, 14)}`);

  const { connected, lastEvent } = useWebSocketMeter();

  useEffect(() => {
    if (!lastEvent || lastEvent.type !== "transaction") return;
    setLiveEvents(prev => [lastEvent, ...prev].slice(0, 30));
  }, [lastEvent]);

  useEffect(() => {
    Promise.all([
      fetch("/api/mcp/catalog").then(r => r.json()),
      fetch("/api/consumers/").then(r => r.json()),
    ]).then(([catalogData, consumersData]) => {
      setCatalog(catalogData);
      setConsumers(consumersData);
      if (catalogData.length > 0) setSelectedTool(catalogData[0]);
      const consumer = justOnboarded && consumersData.length > 0
        ? consumersData[consumersData.length - 1]
        : consumersData[0];
      if (consumer) setSelectedConsumer(consumer);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [justOnboarded]);

  // Load usage history when consumer changes
  useEffect(() => {
    if (!selectedConsumer) return;
    fetch(`/api/consumers/${selectedConsumer.id}/transactions`)
      .then(r => r.json())
      .then(setUsageHistory);
  }, [selectedConsumer]);

  useEffect(() => {
    if (selectedTool) {
      const example = EXAMPLE_QUERIES[selectedTool.name];
      setParams(example?.params || {});
    }
  }, [selectedTool]);

  // Filter catalog
  const categories = useMemo(() => {
    const cats = new Set(catalog.map(t => t.category));
    return Array.from(cats).sort();
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter(tool => {
      const matchesSearch = !searchQuery ||
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = !selectedCategory || tool.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [catalog, searchQuery, selectedCategory]);

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
      setQueryHistory(prev => [data, ...prev].slice(0, 50));

      // Refresh consumer data
      const updated = await fetch(`/api/consumers/${selectedConsumer.id}`).then(r => r.json());
      setSelectedConsumer(updated);
      setConsumers(prev => prev.map(c => c.id === updated.id ? updated : c));

      // Refresh usage history
      const txns = await fetch(`/api/consumers/${selectedConsumer.id}/transactions`).then(r => r.json());
      setUsageHistory(txns);
    } catch (err) {
      console.error(err);
    } finally {
      setExecuting(false);
    }
  }, [selectedTool, selectedConsumer, params, sessionId]);

  const runExampleQuery = useCallback((toolName: string) => {
    const tool = catalog.find(t => t.name === toolName);
    if (tool) {
      setSelectedTool(tool);
      const example = EXAMPLE_QUERIES[toolName];
      if (example) setParams(example.params);
      // Auto-execute after a tick
      setTimeout(() => {
        const btn = document.getElementById("execute-btn");
        if (btn) btn.click();
      }, 100);
    }
  }, [catalog]);

  const copyApiKey = () => {
    if (selectedConsumer) {
      navigator.clipboard.writeText(selectedConsumer.api_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const computePreviewCost = () => {
    if (!selectedTool || !selectedConsumer) return null;
    const n = Object.keys(params).length;
    const cm = n >= 4 ? 1.8 : n === 3 ? 1.5 : n === 2 ? 1.2 : 1.0;
    const qc = selectedConsumer.query_count;
    const vm = qc >= 10000 ? 0.85 : qc >= 1000 ? 0.90 : qc >= 100 ? 0.95 : 1.0;
    const cost = selectedTool.price_per_call * cm * vm;
    return { base: selectedTool.price_per_call, cm, vm, cost };
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const preview = computePreviewCost();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Zap className="h-7 w-7 text-brand-400" />
            <h1 className="text-3xl font-bold">Consumer Portal</h1>
          </div>
          <p className="text-gray-400">
            Browse the context catalog, run queries via MCP proxy, and track usage costs
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {connected ? (
            <Badge variant="green" dot>Live Meter</Badge>
          ) : (
            <Badge variant="yellow" dot>Disconnected</Badge>
          )}
        </div>
      </div>

      {showOnboardBanner && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <strong>Consumer account created!</strong> Your API key is ready.
            {selectedConsumer && (
              <span className="ml-2 font-mono text-xs text-emerald-400/70">
                {selectedConsumer.api_key.slice(0, 20)}...
              </span>
            )}
          </div>
          <button onClick={() => setShowOnboardBanner(false)} className="text-xs text-gray-500 hover:text-gray-300">Dismiss</button>
        </div>
      )}

      <PrivacyBadgeRow />

      {/* Consumer selector row */}
      <div className="mt-6 mb-6 flex items-end gap-4">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Querying As</label>
          <div className="relative">
            <select
              value={selectedConsumer?.id || ""}
              onChange={e => setSelectedConsumer(consumers.find(c => c.id === Number(e.target.value)) || null)}
              className="w-full appearance-none rounded-lg border border-white/10 bg-surface-200 px-4 py-2.5 pr-10 text-sm focus:border-brand-500 focus:outline-none"
            >
              {consumers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.organization}) — {c.plan}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
          </div>
        </div>
        {selectedConsumer && (
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center">
              <p className="text-gray-500">Spent</p>
              <p className="font-semibold text-amber-400">{formatCurrency(selectedConsumer.total_spent)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">Queries</p>
              <p className="font-semibold text-brand-300">{selectedConsumer.query_count}</p>
            </div>
            <button onClick={copyApiKey} className="btn-secondary py-2 px-3 text-xs">
              {copiedKey ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copiedKey ? "Copied!" : "API Key"}
            </button>
          </div>
        )}
      </div>

      <Tabs defaultValue="catalog">
        <TabsList className="mb-6">
          <TabsTrigger value="catalog">
            <Search className="mr-1.5 inline h-3.5 w-3.5" />Context Catalog
          </TabsTrigger>
          <TabsTrigger value="query">
            <Play className="mr-1.5 inline h-3.5 w-3.5" />Query Builder
          </TabsTrigger>
          <TabsTrigger value="usage">
            <History className="mr-1.5 inline h-3.5 w-3.5" />Usage History
          </TabsTrigger>
        </TabsList>

        {/* ━━━ Catalog Tab ━━━ */}
        <TabsContent value="catalog">
          {/* Search + filter */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search tools by name or description..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-surface-200 pl-10 pr-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  !selectedCategory ? "bg-brand-600/20 text-brand-300" : "bg-surface-100 text-gray-400 hover:text-gray-200"
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    selectedCategory === cat ? "bg-brand-600/20 text-brand-300" : "bg-surface-100 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {cat.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCatalog.map(tool => {
              const example = EXAMPLE_QUERIES[tool.name];
              return (
                <Card key={tool.id} className="flex flex-col">
                  <CardContent className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <Badge variant="purple">{tool.category.replace(/_/g, " ")}</Badge>
                      <span className="text-xs font-semibold text-emerald-400">{formatCurrency(tool.price_per_call)} base</span>
                    </div>
                    <h3 className="font-mono text-sm font-semibold text-brand-300">{tool.name}</h3>
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{tool.description}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{formatNumber(tool.call_count)} calls</span>
                      <span>{tool.avg_latency_ms}ms avg</span>
                    </div>
                  </CardContent>
                  <div className="border-t border-white/[0.06] px-6 py-3 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedTool(tool);
                        if (example) setParams(example.params);
                      }}
                      className="flex-1 btn-secondary py-2 text-xs justify-center"
                    >
                      <Layers className="h-3 w-3" />
                      Select Tool
                    </button>
                    {example && (
                      <button
                        onClick={() => runExampleQuery(tool.name)}
                        className="flex-1 btn-primary py-2 text-xs justify-center"
                      >
                        <Play className="h-3 w-3" />
                        {example.label}
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {filteredCatalog.length === 0 && (
            <p className="py-12 text-center text-gray-500">No tools match your search criteria</p>
          )}
        </TabsContent>

        {/* ━━━ Query Builder Tab ━━━ */}
        <TabsContent value="query">
          <div className="grid gap-8 lg:grid-cols-5">
            {/* Left: Tool list */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <Layers className="h-4 w-4 text-brand-400" />
                  <CardTitle>Selected Tool</CardTitle>
                </CardHeader>
                <div className="max-h-[500px] overflow-y-auto p-2">
                  {catalog.map(tool => (
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
                        <Badge variant="purple">{tool.category.replace(/_/g, " ")}</Badge>
                        <span className="text-emerald-400">{formatCurrency(tool.price_per_call)} base</span>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right: Builder + results */}
            <div className="lg:col-span-3 space-y-6">
              {selectedTool && (
                <Card>
                  <CardHeader>
                    <Route className="h-4 w-4 text-brand-400" />
                    <CardTitle>MCP Invoke — {selectedTool.name}</CardTitle>
                    <Badge variant="green" className="ml-auto">{formatCurrency(selectedTool.price_per_call)} base</Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-400">{selectedTool.description}</p>

                    {/* Live cost preview */}
                    {preview && (
                      <div className="rounded-lg bg-surface-200/50 p-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">Estimated Cost</p>
                        <div className="flex items-center gap-1 text-xs font-mono text-gray-400">
                          <span className="text-brand-300">${preview.base.toFixed(4)}</span>
                          <span>×</span>
                          <span className="text-amber-400">{preview.cm}x</span>
                          <span className="text-gray-600">complexity</span>
                          <span>×</span>
                          <span className="text-cyan-400">{preview.vm}x</span>
                          <span className="text-gray-600">volume</span>
                          <span>=</span>
                          <span className="text-white font-bold">${preview.cost.toFixed(4)}</span>
                        </div>
                      </div>
                    )}

                    {/* Example query buttons */}
                    {EXAMPLE_QUERIES[selectedTool.name] && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Quick fill:</p>
                        <button
                          onClick={() => {
                            const ex = EXAMPLE_QUERIES[selectedTool.name];
                            if (ex) setParams(ex.params);
                          }}
                          className="btn-secondary py-1.5 px-3 text-xs"
                        >
                          <Play className="h-3 w-3" />
                          {EXAMPLE_QUERIES[selectedTool.name].label}
                        </button>
                      </div>
                    )}

                    <Textarea
                      label="Parameters (JSON)"
                      rows={7}
                      value={JSON.stringify(params, null, 2)}
                      onChange={e => { try { setParams(JSON.parse(e.target.value)); } catch { /* ignore */ } }}
                    />

                    <button
                      id="execute-btn"
                      onClick={executeQuery}
                      disabled={executing}
                      className="btn-primary w-full justify-center disabled:opacity-50"
                    >
                      {executing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                      {executing ? "Routing via MCP proxy..." : "Execute MCP Invoke"}
                    </button>

                    <p className="text-[10px] text-gray-600 font-mono text-center">Session: {sessionId}</p>
                  </CardContent>
                </Card>
              )}

              {/* Receipt / Result */}
              {result && (
                <Card>
                  <CardHeader>
                    <Receipt className="h-5 w-5 text-emerald-400" />
                    <CardTitle>Query Receipt</CardTitle>
                    <span className="ml-auto text-[10px] font-mono text-gray-600">{result.session_id}</span>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Top metrics */}
                    <div className="grid grid-cols-3 gap-3">
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

                    {/* Cost formula */}
                    <div className="rounded-lg border border-white/[0.06] bg-surface-100 p-4">
                      <p className="text-xs font-semibold text-gray-300 mb-2">Cost Breakdown</p>
                      <p className="text-xs font-mono text-gray-400">{result.cost_breakdown.formula}</p>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded bg-surface-200/50 p-2 text-center">
                          <p className="text-gray-500">Base</p>
                          <p className="font-mono text-brand-300">${result.cost_breakdown.base_cost.toFixed(4)}</p>
                        </div>
                        <div className="rounded bg-surface-200/50 p-2 text-center">
                          <p className="text-gray-500">Complexity</p>
                          <p className="font-mono text-amber-400">{result.cost_breakdown.complexity_multiplier}x</p>
                        </div>
                        <div className="rounded bg-surface-200/50 p-2 text-center">
                          <p className="text-gray-500">Volume</p>
                          <p className="font-mono text-cyan-400">{result.cost_breakdown.volume_multiplier}x</p>
                        </div>
                      </div>
                    </div>

                    {/* Revenue split */}
                    <div className="rounded-lg border border-white/[0.06] bg-surface-100 p-4">
                      <p className="text-xs font-semibold text-gray-300 mb-2">Revenue Split</p>
                      <div className="flex gap-2">
                        <div className="flex-1 rounded bg-emerald-500/5 p-3 text-center">
                          <p className="text-xs text-gray-400">Provider</p>
                          <p className="text-sm font-bold text-emerald-400">{formatCurrency(result.reward_breakdown.total_provider_payout)}</p>
                          <div className="mt-1 text-[10px] text-gray-500 space-y-0.5">
                            <p>Base 70%: {formatCurrency(result.reward_breakdown.provider_base_payout)}</p>
                            {result.reward_breakdown.uptime_bonus > 0 && <p className="text-emerald-500">+Uptime: {formatCurrency(result.reward_breakdown.uptime_bonus)}</p>}
                            {result.reward_breakdown.quality_bonus > 0 && <p className="text-emerald-500">+Quality: {formatCurrency(result.reward_breakdown.quality_bonus)}</p>}
                          </div>
                        </div>
                        <div className="flex-1 rounded bg-brand-500/5 p-3 text-center">
                          <p className="text-xs text-gray-400">Platform</p>
                          <p className="text-sm font-bold text-brand-400">{formatCurrency(result.reward_breakdown.platform_fee)}</p>
                          <p className="mt-1 text-[10px] text-gray-500">{((result.reward_breakdown.platform_fee / result.cost) * 100).toFixed(1)}% effective</p>
                        </div>
                      </div>
                    </div>

                    {/* Flow */}
                    <div className="flex items-center justify-center gap-2 text-xs py-1">
                      <Badge variant="blue">You</Badge>
                      <ArrowRight className="h-3 w-3 text-gray-500" />
                      <span className="font-mono text-white">${result.cost.toFixed(4)}</span>
                      <ArrowRight className="h-3 w-3 text-gray-500" />
                      <Badge variant="purple">Proxy</Badge>
                      <ArrowRight className="h-3 w-3 text-gray-500" />
                      <span className="font-mono text-emerald-400">${result.reward_breakdown.total_provider_payout.toFixed(4)}</span>
                      <ArrowRight className="h-3 w-3 text-gray-500" />
                      <Badge variant="green">Provider</Badge>
                    </div>

                    <div className="rounded bg-surface-200/30 px-3 py-2 text-xs text-gray-500 font-mono">
                      <Route className="inline h-3 w-3 mr-1" />Routed to: {result.routed_to}
                    </div>

                    {/* Response data */}
                    <details>
                      <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-300">
                        View Response Data
                      </summary>
                      <pre className="mt-2 max-h-[250px] overflow-auto rounded-lg bg-surface-200 p-4 text-xs font-mono text-gray-300">
                        {JSON.stringify(result.result, null, 2)}
                      </pre>
                    </details>

                    {/* Privacy badges */}
                    <div className="flex flex-wrap gap-2">
                      {(result.privacy_badges || []).map(badge => (
                        <Badge key={badge} variant="green">
                          <Shield className="h-3 w-3" />{badge}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ━━━ Usage History Tab ━━━ */}
        <TabsContent value="usage">
          {/* Summary cards */}
          {selectedConsumer && (
            <div className="grid gap-4 sm:grid-cols-4 mb-8">
              <StatCard icon={DollarSign} label="Total Spent" value={formatCurrency(selectedConsumer.total_spent)} valueColor="text-amber-400" iconColor="text-amber-400" />
              <StatCard icon={Zap} label="Total Queries" value={formatNumber(selectedConsumer.query_count)} iconColor="text-brand-400" />
              <StatCard
                icon={DollarSign}
                label="Avg Cost/Query"
                value={selectedConsumer.query_count > 0 ? formatCurrency(selectedConsumer.total_spent / selectedConsumer.query_count) : "$0.00"}
                iconColor="text-cyan-400"
                valueColor="text-cyan-400"
              />
              <StatCard icon={Tag} label="Plan" value={selectedConsumer.plan} iconColor="text-purple-400" />
            </div>
          )}

          <Card>
            <CardHeader>
              <History className="h-5 w-5 text-brand-400" />
              <CardTitle>Transaction History</CardTitle>
              <span className="ml-auto text-xs text-gray-500">{usageHistory.length} transactions</span>
            </CardHeader>
            <DataTable
              columns={[
                {
                  key: "id",
                  header: "#",
                  className: "w-12",
                  render: (t: Transaction) => <span className="text-gray-500">#{t.id}</span>,
                },
                {
                  key: "tool",
                  header: "Tool",
                  render: (t: Transaction) => <span className="font-mono text-brand-300 text-xs">{t.tool_name}</span>,
                },
                {
                  key: "cost",
                  header: "Cost",
                  render: (t: Transaction) => (
                    <div>
                      <span className="font-semibold text-amber-400">{formatCurrency(t.cost)}</span>
                      <p className="text-[10px] text-gray-600 font-mono">
                        {t.base_cost.toFixed(3)} × {t.complexity_multiplier}x × {t.volume_multiplier}x
                      </p>
                    </div>
                  ),
                },
                {
                  key: "provider_payout",
                  header: "Provider",
                  render: (t: Transaction) => <span className="text-emerald-400">{formatCurrency(t.provider_payout)}</span>,
                },
                {
                  key: "platform",
                  header: "Platform",
                  render: (t: Transaction) => <span className="text-gray-400">{formatCurrency(t.platform_fee)}</span>,
                },
                {
                  key: "latency",
                  header: "Latency",
                  render: (t: Transaction) => <span className="text-gray-500">{t.latency_ms}ms</span>,
                },
                {
                  key: "bonuses",
                  header: "Bonuses",
                  render: (t: Transaction) => (
                    <div className="flex gap-1">
                      {t.uptime_bonus > 0 && <Badge variant="green">+uptime</Badge>}
                      {t.quality_bonus > 0 && <Badge variant="cyan">+quality</Badge>}
                      {t.uptime_bonus === 0 && t.quality_bonus === 0 && <span className="text-gray-600">—</span>}
                    </div>
                  ),
                },
              ]}
              data={usageHistory}
              emptyMessage="No queries yet — go to the Catalog tab and run some!"
            />
          </Card>

          {/* Live feed */}
          {liveEvents.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <Wifi className="h-4 w-4 text-emerald-400 animate-pulse" />
                <CardTitle>Live Platform Feed</CardTitle>
              </CardHeader>
              <div className="max-h-[200px] overflow-y-auto p-4 space-y-2">
                {liveEvents.map((ev, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-surface-200/20 px-4 py-2 text-xs">
                    <div>
                      <span className="font-mono text-brand-300">{ev.tool_name}</span>
                      <span className="ml-2 text-gray-500">{ev.consumer_name} → {ev.provider_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{ev.latency_ms}ms</span>
                      <span className="font-semibold text-emerald-400">${ev.cost_breakdown?.final_cost?.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
