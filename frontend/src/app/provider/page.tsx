"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Database,
  DollarSign,
  Activity,
  TrendingUp,
  Server,
  Shield,
  Gauge,
  Calculator,
  Plus,
  Wifi,
  WifiOff,
  ArrowRight,
  CheckCircle2,
  Copy,
  Loader2,
  BarChart3,
  Tag,
  Download,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useWebSocketMeter } from "@/lib/useWebSocketMeter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { PrivacyBanner, PrivacyBadgeRow } from "@/components/ui/PrivacyBanner";
import type {
  Provider, MCPTool, Transaction, PayoutSimulation,
  EarningsDataPoint,
} from "@/lib/api";

// Dynamic import for Recharts (client-only)
import dynamic from "next/dynamic";
const AreaChart = dynamic(() => import("recharts").then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then(m => m.Area), { ssr: false });
const XAxis = dynamic(() => import("recharts").then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then(m => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(m => m.ResponsiveContainer), { ssr: false });
const BarChartComponent = dynamic(() => import("recharts").then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then(m => m.Bar), { ssr: false });

export default function ProviderPortal() {
  const searchParams = useSearchParams();
  const justOnboarded = searchParams.get("onboarded") === "true";

  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [earningsData, setEarningsData] = useState<EarningsDataPoint[]>([]);
  const [simulation, setSimulation] = useState<PayoutSimulation | null>(null);
  const [expandedTxn, setExpandedTxn] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboardBanner, setShowOnboardBanner] = useState(justOnboarded);
  const [copiedKey, setCopiedKey] = useState(false);

  // Registration form
  const [regForm, setRegForm] = useState({
    name: "",
    organization: "",
    endpoint: "",
    tags: "",
  });
  const [registering, setRegistering] = useState(false);

  const [simForm, setSimForm] = useState({
    monthly_queries: 10000,
    uptime_score: 99.5,
    quality_score: 95.0,
    price_per_call: 0.08,
  });

  const { connected, lastEvent } = useWebSocketMeter();

  const refreshProvider = useCallback(async (p: Provider) => {
    const [updatedP, toolsData, txnsData, earningsRes] = await Promise.all([
      fetch(`/api/providers/${p.id}`).then(r => r.json()),
      fetch(`/api/providers/${p.id}/tools`).then(r => r.json()),
      fetch(`/api/providers/${p.id}/transactions`).then(r => r.json()),
      fetch(`/api/providers/${p.id}/earnings-history`).then(r => r.json()),
    ]);
    setSelectedProvider(updatedP);
    setProviders(prev => prev.map(pp => pp.id === updatedP.id ? updatedP : pp));
    setTools(toolsData);
    setTransactions(txnsData);
    setEarningsData(earningsRes.data || []);
  }, []);

  // Live WebSocket updates
  useEffect(() => {
    if (!lastEvent || lastEvent.type !== "transaction" || !selectedProvider) return;
    if (lastEvent.provider_id === selectedProvider.id) {
      refreshProvider(selectedProvider);
    }
  }, [lastEvent, selectedProvider, refreshProvider]);

  useEffect(() => {
    fetch("/api/providers/")
      .then(r => r.json())
      .then((data: Provider[]) => {
        setProviders(data);
        if (data.length > 0) {
          const last = justOnboarded ? data[data.length - 1] : data[0];
          setSelectedProvider(last);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [justOnboarded]);

  useEffect(() => {
    if (!selectedProvider) return;
    refreshProvider(selectedProvider);
  }, [selectedProvider?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRegister = async () => {
    if (!regForm.name || !regForm.organization || !regForm.endpoint) return;
    setRegistering(true);
    try {
      const res = await fetch("/api/providers/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regForm.name,
          organization: regForm.organization,
          mcp_endpoint: regForm.endpoint,
          data_domains: regForm.tags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        const newProvider: Provider = await res.json();
        setProviders(prev => [...prev, newProvider]);
        setSelectedProvider(newProvider);
        setRegForm({ name: "", organization: "", endpoint: "", tags: "" });
      }
    } catch { /* ignore */ }
    setRegistering(false);
  };

  const runSimulation = () => {
    fetch("/api/providers/simulate-payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(simForm),
    }).then(r => r.json()).then(setSimulation);
  };

  const copyApiKey = () => {
    if (selectedProvider) {
      navigator.clipboard.writeText(selectedProvider.api_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  // Per-tool earnings for bar chart
  const toolEarnings = tools.map(t => ({
    name: t.name.replace(/^(get_|query_)/, ""),
    calls: t.call_count,
    revenue: Math.round(t.call_count * t.price_per_call * 0.7 * 100) / 100,
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Database className="h-7 w-7 text-brand-400" />
            <h1 className="text-3xl font-bold">Provider Portal</h1>
          </div>
          <p className="text-gray-400">
            Register MCP servers, monitor live earnings, and optimize performance
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

      {/* Onboard banner */}
      {showOnboardBanner && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <strong>Provider registered successfully!</strong> Your MCP server is now live on the marketplace.
            {selectedProvider && (
              <span className="ml-2 font-mono text-xs text-emerald-400/70">
                API Key: {selectedProvider.api_key.slice(0, 20)}...
              </span>
            )}
          </div>
          <button onClick={() => setShowOnboardBanner(false)} className="text-xs text-gray-500 hover:text-gray-300">Dismiss</button>
        </div>
      )}

      <PrivacyBadgeRow />

      {/* Provider selector */}
      <div className="mt-6 mb-6 flex gap-3 overflow-x-auto pb-2">
        {providers.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedProvider(p)}
            className={`shrink-0 rounded-xl border px-5 py-3 text-left transition-all ${
              selectedProvider?.id === p.id
                ? "border-brand-500/50 bg-brand-600/10"
                : "border-white/[0.06] bg-surface-50 hover:border-white/10"
            }`}
          >
            <p className="font-semibold text-sm">{p.organization}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={p.status === "active" ? "green" : "yellow"} dot>
                {p.status}
              </Badge>
              <span className="text-xs text-gray-500">{formatCurrency(p.total_earnings)}</span>
            </div>
          </button>
        ))}
      </div>

      {selectedProvider && (
        <Tabs defaultValue="dashboard">
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">
              <BarChart3 className="mr-1.5 inline h-3.5 w-3.5" />Dashboard
            </TabsTrigger>
            <TabsTrigger value="tools">
              <Activity className="mr-1.5 inline h-3.5 w-3.5" />Tools & Transactions
            </TabsTrigger>
            <TabsTrigger value="simulator">
              <Calculator className="mr-1.5 inline h-3.5 w-3.5" />Payout Simulator
            </TabsTrigger>
            <TabsTrigger value="register">
              <Plus className="mr-1.5 inline h-3.5 w-3.5" />Register MCP Server
            </TabsTrigger>
          </TabsList>

          {/* ━━━ Dashboard Tab ━━━ */}
          <TabsContent value="dashboard">
            {/* Stats row */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              <StatCard
                icon={DollarSign}
                label="Total Earnings"
                value={formatCurrency(selectedProvider.total_earnings)}
                subtitle="Revenue × 0.70 + bonuses"
                iconColor="text-emerald-400"
                valueColor="text-emerald-400"
              />
              <StatCard
                icon={Gauge}
                label="Uptime Score"
                value={`${selectedProvider.uptime_score}%`}
                subtitle={selectedProvider.uptime_score >= 99.5 ? "+3% bonus active" : "Below 99.5% threshold"}
                iconColor={selectedProvider.uptime_score >= 99.5 ? "text-emerald-400" : "text-amber-400"}
              />
              <StatCard
                icon={TrendingUp}
                label="Quality Score"
                value={`${selectedProvider.quality_score}%`}
                subtitle={selectedProvider.quality_score >= 95.0 ? "+2% bonus active" : "Below 95% threshold"}
                iconColor={selectedProvider.quality_score >= 95.0 ? "text-emerald-400" : "text-amber-400"}
              />
              <StatCard
                icon={Activity}
                label="Total Queries"
                value={formatNumber(transactions.length)}
                subtitle={`${tools.length} active tools`}
              />
            </div>

            {/* API Key */}
            <Card className="mb-6">
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-brand-400" />
                  <div>
                    <p className="text-xs text-gray-400">MCP Endpoint</p>
                    <p className="font-mono text-sm text-brand-300">{selectedProvider.mcp_endpoint}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/providers/${selectedProvider.id}/export-csv`}
                    download
                    className="btn-secondary py-2 px-3 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Payout Report
                  </a>
                  <button onClick={copyApiKey} className="btn-secondary py-2 px-3 text-xs">
                    {copiedKey ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey ? "Copied!" : "Copy API Key"}
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2 mb-8">
              {/* Cumulative earnings chart */}
              <Card>
                <CardHeader>
                  <TrendingUp className="h-5 w-5 text-brand-400" />
                  <CardTitle>Cumulative Earnings</CardTitle>
                </CardHeader>
                <CardContent>
                  {earningsData.length === 0 ? (
                    <p className="py-12 text-center text-sm text-gray-500">Run queries from the Consumer Portal to see earnings grow</p>
                  ) : (
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={earningsData}>
                          <defs>
                            <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="index" tick={{ fontSize: 11, fill: "#6b7280" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} width={60} />
                          <Tooltip
                            contentStyle={{ background: "#1a1726", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.75rem", fontSize: "12px" }}
                            labelFormatter={(label: number) => `Query #${label}`}
                            formatter={(value: number, name: string) => [`$${value.toFixed(4)}`, name === "cumulative" ? "Total Earned" : "This Query"]}
                          />
                          <Area type="monotone" dataKey="cumulative" stroke="#10b981" fill="url(#earnGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Per-tool revenue bar chart */}
              <Card>
                <CardHeader>
                  <BarChart3 className="h-5 w-5 text-brand-400" />
                  <CardTitle>Revenue by Tool</CardTitle>
                </CardHeader>
                <CardContent>
                  {toolEarnings.every(t => t.calls === 0) ? (
                    <p className="py-12 text-center text-sm text-gray-500">No tool calls yet</p>
                  ) : (
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChartComponent data={toolEarnings} layout="vertical">
                          <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(v: number) => `$${v}`} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} width={120} />
                          <Tooltip
                            contentStyle={{ background: "#1a1726", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "0.75rem", fontSize: "12px" }}
                            formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                          />
                          <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
                        </BarChartComponent>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Performance bonuses */}
            <Card className="mb-8">
              <CardHeader>
                <DollarSign className="h-5 w-5 text-emerald-400" />
                <CardTitle>Active Performance Bonuses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {
                      name: "Uptime Bonus",
                      rate: "3%",
                      threshold: "≥ 99.5%",
                      active: selectedProvider.uptime_score >= 99.5,
                      current: `${selectedProvider.uptime_score}%`,
                    },
                    {
                      name: "Quality Bonus",
                      rate: "2%",
                      threshold: "≥ 95.0%",
                      active: selectedProvider.quality_score >= 95.0,
                      current: `${selectedProvider.quality_score}%`,
                    },
                    {
                      name: "Volume Bonus",
                      rate: "2-8%",
                      threshold: "≥ 10k queries/mo",
                      active: transactions.length >= 20,
                      current: `${transactions.length} queries`,
                    },
                    {
                      name: "Freshness Bonus",
                      rate: "2%",
                      threshold: "Weekly updates",
                      active: true,
                      current: "Active",
                    },
                  ].map(b => (
                    <div key={b.name} className={`rounded-xl p-4 border ${b.active ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/[0.04] bg-surface-100"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-400">{b.name}</span>
                        <Badge variant={b.active ? "green" : "yellow"}>{b.active ? "Active" : "Inactive"}</Badge>
                      </div>
                      <p className="text-lg font-bold gradient-text">+{b.rate}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {b.threshold} · <span className={b.active ? "text-emerald-400" : "text-amber-400"}>{b.current}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <PrivacyBanner />
          </TabsContent>

          {/* ━━━ Tools & Transactions Tab ━━━ */}
          <TabsContent value="tools">
            {/* Tools table */}
            <Card className="mb-8">
              <CardHeader>
                <Activity className="h-5 w-5 text-brand-400" />
                <CardTitle>Registered MCP Tools</CardTitle>
                <span className="ml-auto text-xs text-gray-500">{tools.length} tools</span>
              </CardHeader>
              <DataTable
                columns={[
                  {
                    key: "name",
                    header: "Tool Name",
                    render: (t: MCPTool) => <span className="font-mono text-brand-300">{t.name}</span>,
                  },
                  {
                    key: "category",
                    header: "Category",
                    render: (t: MCPTool) => <Badge variant="purple">{t.category}</Badge>,
                  },
                  {
                    key: "price",
                    header: "Base Price",
                    render: (t: MCPTool) => <span className="text-emerald-400">{formatCurrency(t.price_per_call)}</span>,
                  },
                  {
                    key: "calls",
                    header: "Total Calls",
                    render: (t: MCPTool) => formatNumber(t.call_count),
                  },
                  {
                    key: "latency",
                    header: "Avg Latency",
                    render: (t: MCPTool) => <span className="text-gray-400">{t.avg_latency_ms}ms</span>,
                  },
                  {
                    key: "revenue",
                    header: "Est. Revenue",
                    render: (t: MCPTool) => (
                      <span className="text-emerald-400 font-semibold">
                        ~{formatCurrency(t.call_count * t.price_per_call * 0.7)}
                      </span>
                    ),
                  },
                ]}
                data={tools}
                emptyMessage="No tools registered yet"
              />
            </Card>

            {/* Transactions with expandable math */}
            <Card>
              <CardHeader>
                <DollarSign className="h-5 w-5 text-emerald-400" />
                <CardTitle>Transaction History</CardTitle>
                <span className="ml-auto text-xs text-gray-500">{transactions.length} transactions</span>
              </CardHeader>
              <div className="max-h-[600px] overflow-y-auto p-4 space-y-2">
                {transactions.length === 0 ? (
                  <p className="py-12 text-center text-sm text-gray-500">
                    No transactions yet — run queries from the Consumer Portal!
                  </p>
                ) : (
                  transactions.map(txn => (
                    <div key={txn.id}>
                      <button
                        onClick={() => setExpandedTxn(expandedTxn === txn.id ? null : txn.id)}
                        className="w-full rounded-lg bg-surface-200/30 px-4 py-3 text-left hover:bg-surface-200/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-mono text-brand-300">{txn.tool_name}</p>
                            <p className="text-xs text-gray-500">{txn.latency_ms}ms · #{txn.id}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-emerald-400">+{formatCurrency(txn.provider_payout)}</p>
                            <p className="text-xs text-gray-500">of {formatCurrency(txn.cost)}</p>
                          </div>
                        </div>
                      </button>
                      {expandedTxn === txn.id && (
                        <div className="mx-2 mt-1 mb-2 rounded-lg border border-white/[0.06] bg-surface-100 p-4 text-xs space-y-3">
                          <div>
                            <p className="font-semibold text-gray-300 mb-1">Consumer Cost</p>
                            <p className="font-mono text-gray-400">
                              <span className="text-brand-300">${txn.base_cost.toFixed(4)}</span>
                              {" × "}<span className="text-amber-400">{txn.complexity_multiplier}x</span> complexity
                              {" × "}<span className="text-cyan-400">{txn.volume_multiplier}x</span> volume
                              {" = "}<span className="text-white font-bold">${txn.cost.toFixed(4)}</span>
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-300 mb-1">Provider Reward</p>
                            <div className="space-y-1 font-mono">
                              <div className="flex justify-between"><span className="text-gray-400">Base 70%</span><span>${txn.provider_base_payout.toFixed(4)}</span></div>
                              {txn.uptime_bonus > 0 && <div className="flex justify-between text-emerald-400"><span>+ Uptime 3%</span><span>+${txn.uptime_bonus.toFixed(4)}</span></div>}
                              {txn.quality_bonus > 0 && <div className="flex justify-between text-emerald-400"><span>+ Quality 2%</span><span>+${txn.quality_bonus.toFixed(4)}</span></div>}
                              <div className="border-t border-white/[0.06] pt-1 flex justify-between font-bold">
                                <span className="text-emerald-400">You receive</span>
                                <span className="text-emerald-400">${txn.provider_payout.toFixed(4)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-gray-500">
                            <Badge variant="blue">Consumer</Badge>
                            <ArrowRight className="h-3 w-3" />
                            <span className="text-white">${txn.cost.toFixed(4)}</span>
                            <ArrowRight className="h-3 w-3" />
                            <Badge variant="purple">ContextRx</Badge>
                            <ArrowRight className="h-3 w-3" />
                            <span className="text-emerald-400">${txn.provider_payout.toFixed(4)}</span>
                            <ArrowRight className="h-3 w-3" />
                            <Badge variant="green">You</Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          {/* ━━━ Payout Simulator Tab ━━━ */}
          <TabsContent value="simulator">
            <div className="grid gap-8 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <Calculator className="h-5 w-5 text-brand-400" />
                  <CardTitle>Payout Simulator</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Estimate your monthly earnings based on query volume and performance scores.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Monthly Queries"
                      type="number"
                      step={1000}
                      value={simForm.monthly_queries}
                      onChange={e => setSimForm({ ...simForm, monthly_queries: parseInt(e.target.value) || 0 })}
                    />
                    <Input
                      label="Uptime Score (%)"
                      type="number"
                      step={0.1}
                      value={simForm.uptime_score}
                      onChange={e => setSimForm({ ...simForm, uptime_score: parseFloat(e.target.value) || 0 })}
                    />
                    <Input
                      label="Quality Score (%)"
                      type="number"
                      step={0.5}
                      value={simForm.quality_score}
                      onChange={e => setSimForm({ ...simForm, quality_score: parseFloat(e.target.value) || 0 })}
                    />
                    <Input
                      label="Price per Call ($)"
                      type="number"
                      step={0.01}
                      value={simForm.price_per_call}
                      onChange={e => setSimForm({ ...simForm, price_per_call: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <button onClick={runSimulation} className="btn-primary w-full justify-center">
                    <Calculator className="h-4 w-4" />
                    Calculate Monthly Payout
                  </button>

                  <p className="text-xs text-gray-600 text-center">
                    &ldquo;If you serve {formatNumber(simForm.monthly_queries)} more queries this month...&rdquo;
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                  <CardTitle>Projected Payout</CardTitle>
                </CardHeader>
                <CardContent>
                  {!simulation ? (
                    <p className="py-16 text-center text-sm text-gray-500">Run the simulator to see your projected payout breakdown</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-xl bg-gradient-to-br from-brand-600/10 to-purple-600/10 border border-brand-500/20 p-6 text-center">
                        <p className="text-xs text-gray-400 mb-1">Estimated Monthly Payout</p>
                        <p className="text-4xl font-bold gradient-text">{formatCurrency(simulation.total_payout)}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          from {formatCurrency(simForm.monthly_queries * simForm.price_per_call)} gross revenue
                        </p>
                      </div>

                      <div className="space-y-2 text-sm">
                        {[
                          { label: "Base Payout (70%)", value: simulation.base_payout, color: "" },
                          { label: "+ Uptime Bonus", value: simulation.uptime_bonus, color: "text-emerald-400" },
                          { label: "+ Quality Bonus", value: simulation.quality_bonus, color: "text-emerald-400" },
                          { label: "+ Volume Bonus", value: simulation.volume_bonus, color: "text-emerald-400" },
                          { label: "+ Freshness Bonus", value: simulation.freshness_bonus, color: "text-emerald-400" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className={`flex justify-between ${color}`}>
                            <span className={color || "text-gray-400"}>{label}</span>
                            <span>{formatCurrency(value)}</span>
                          </div>
                        ))}
                        <div className="border-t border-white/10 pt-2 flex justify-between text-xs text-gray-500">
                          <span>Platform Fee</span>
                          <span>{formatCurrency(simulation.platform_fee)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ━━━ Register Tab ━━━ */}
          <TabsContent value="register">
            <Card className="max-w-2xl">
              <CardHeader>
                <Plus className="h-5 w-5 text-brand-400" />
                <CardTitle>Register New MCP Server</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm text-gray-400">
                  Connect your healthcare data via MCP. Your server exposes pre-aggregated data —
                  raw PHI never leaves your environment.
                </p>

                <Input
                  label="Server Name"
                  placeholder="e.g., Regional Claims Analytics Server"
                  value={regForm.name}
                  onChange={e => setRegForm({ ...regForm, name: e.target.value })}
                />
                <Input
                  label="Organization"
                  placeholder="e.g., BlueCross BlueShield"
                  value={regForm.organization}
                  onChange={e => setRegForm({ ...regForm, organization: e.target.value })}
                />
                <Input
                  label="MCP Endpoint URL"
                  placeholder="https://your-mcp-server.example.com/v1/mcp"
                  value={regForm.endpoint}
                  onChange={e => setRegForm({ ...regForm, endpoint: e.target.value })}
                  hint="The URL where your MCP server accepts tool invocations"
                />
                <Input
                  label="Tags"
                  placeholder="claims, real-time, pharmacy"
                  value={regForm.tags}
                  onChange={e => setRegForm({ ...regForm, tags: e.target.value })}
                  hint="Comma-separated data domain tags"
                />

                <div className="flex items-start gap-3 rounded-lg bg-brand-500/5 border border-brand-500/10 p-3 text-xs text-brand-300">
                  <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    Your MCP server must only expose pre-aggregated, k-anonymized data (k≥50).
                    ContextRx will verify privacy compliance before activating your listing.
                  </p>
                </div>

                <button
                  onClick={handleRegister}
                  disabled={registering || !regForm.name || !regForm.organization || !regForm.endpoint}
                  className="btn-primary w-full justify-center disabled:opacity-50"
                >
                  {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {registering ? "Registering..." : "Register MCP Server"}
                </button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
