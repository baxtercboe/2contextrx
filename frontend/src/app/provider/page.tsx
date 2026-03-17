"use client";

import { useEffect, useState } from "react";
import {
  Database,
  DollarSign,
  Activity,
  TrendingUp,
  Server,
  Shield,
  Gauge,
  Calculator,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { Provider, MCPTool, Transaction, PayoutSimulation } from "@/lib/api";

export default function ProviderPortal() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [simulation, setSimulation] = useState<PayoutSimulation | null>(null);
  const [simForm, setSimForm] = useState({
    monthly_queries: 10000,
    uptime_score: 99.5,
    quality_score: 95.0,
    price_per_call: 0.08,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/providers/")
      .then((r) => r.json())
      .then((data) => {
        setProviders(data);
        if (data.length > 0) {
          setSelectedProvider(data[0]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedProvider) return;
    fetch(`/api/providers/${selectedProvider.id}/tools`)
      .then((r) => r.json())
      .then(setTools);
    fetch(`/api/providers/${selectedProvider.id}/transactions`)
      .then((r) => r.json())
      .then(setTransactions);
  }, [selectedProvider]);

  const runSimulation = () => {
    fetch("/api/providers/simulate-payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(simForm),
    })
      .then((r) => r.json())
      .then(setSimulation);
  };

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
          <Database className="h-7 w-7 text-brand-400" />
          <h1 className="text-3xl font-bold">Provider Portal</h1>
        </div>
        <p className="text-gray-400">
          Register MCP servers, monitor earnings, and track performance metrics
        </p>
      </div>

      {/* Provider selector */}
      <div className="mb-8 flex gap-3 overflow-x-auto pb-2">
        {providers.map((p) => (
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
            <p className="text-xs text-gray-500">{p.status === "active" ? "Active" : p.status}</p>
          </button>
        ))}
      </div>

      {selectedProvider && (
        <>
          {/* Stats row */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="stat-card">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Total Earnings</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                {formatCurrency(selectedProvider.total_earnings)}
              </p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Gauge className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Uptime Score</span>
              </div>
              <p className="text-2xl font-bold">{selectedProvider.uptime_score}%</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Quality Score</span>
              </div>
              <p className="text-2xl font-bold">{selectedProvider.quality_score}%</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Server className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">MCP Endpoint</span>
              </div>
              <p className="truncate text-sm font-mono text-brand-300">
                {selectedProvider.mcp_endpoint}
              </p>
            </div>
          </div>

          {/* Tools table */}
          <div className="mb-8 glass-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-6 py-4">
              <Activity className="h-5 w-5 text-brand-400" />
              <h2 className="font-semibold">Registered MCP Tools</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04] text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3">Tool Name</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Price/Call</th>
                    <th className="px-6 py-3">Total Calls</th>
                    <th className="px-6 py-3">Avg Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map((t) => (
                    <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-6 py-3 font-mono text-brand-300">{t.name}</td>
                      <td className="px-6 py-3">
                        <span className="badge-purple">{t.category}</span>
                      </td>
                      <td className="px-6 py-3 text-emerald-400">{formatCurrency(t.price_per_call)}</td>
                      <td className="px-6 py-3">{formatNumber(t.call_count)}</td>
                      <td className="px-6 py-3 text-gray-400">{t.avg_latency_ms}ms</td>
                    </tr>
                  ))}
                  {tools.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        No tools registered yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Payout simulator */}
            <div className="glass-card">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-6 py-4">
                <Calculator className="h-5 w-5 text-brand-400" />
                <h2 className="font-semibold">Payout Simulator</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Monthly Queries", key: "monthly_queries" as const, step: 1000 },
                    { label: "Uptime Score (%)", key: "uptime_score" as const, step: 0.1 },
                    { label: "Quality Score (%)", key: "quality_score" as const, step: 0.5 },
                    { label: "Price per Call ($)", key: "price_per_call" as const, step: 0.01 },
                  ].map(({ label, key, step }) => (
                    <div key={key}>
                      <label className="mb-1 block text-xs text-gray-400">{label}</label>
                      <input
                        type="number"
                        step={step}
                        value={simForm[key]}
                        onChange={(e) =>
                          setSimForm({ ...simForm, [key]: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full rounded-lg border border-white/10 bg-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
                <button onClick={runSimulation} className="btn-primary w-full justify-center">
                  <Calculator className="h-4 w-4" />
                  Calculate Payout
                </button>

                {simulation && (
                  <div className="mt-4 space-y-2 rounded-xl bg-surface-200/50 p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Base Payout (70%)</span>
                      <span>{formatCurrency(simulation.base_payout)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>+ Uptime Bonus</span>
                      <span>{formatCurrency(simulation.uptime_bonus)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>+ Quality Bonus</span>
                      <span>{formatCurrency(simulation.quality_bonus)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>+ Volume Bonus</span>
                      <span>{formatCurrency(simulation.volume_bonus)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400">
                      <span>+ Freshness Bonus</span>
                      <span>{formatCurrency(simulation.freshness_bonus)}</span>
                    </div>
                    <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-lg">
                      <span>Total Payout</span>
                      <span className="gradient-text">{formatCurrency(simulation.total_payout)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Platform Fee</span>
                      <span>{formatCurrency(simulation.platform_fee)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent transactions */}
            <div className="glass-card">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-6 py-4">
                <DollarSign className="h-5 w-5 text-emerald-400" />
                <h2 className="font-semibold">Recent Transactions</h2>
              </div>
              <div className="max-h-[400px] overflow-y-auto p-4">
                {transactions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    No transactions yet. Run queries from the Consumer Portal!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((txn) => (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between rounded-lg bg-surface-200/30 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-mono text-brand-300">{txn.tool_name}</p>
                          <p className="text-xs text-gray-500">{txn.latency_ms}ms</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-400">
                            +{formatCurrency(txn.provider_payout)}
                          </p>
                          <p className="text-xs text-gray-500">of {formatCurrency(txn.cost)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Privacy notice */}
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">
            <Shield className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              <strong>Privacy Guarantee:</strong> All data exposed through MCP tools is
              pre-aggregated with k-anonymity (k≥50). Raw PHI never leaves the provider
              environment. ContextRx acts solely as a metering and routing proxy.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
