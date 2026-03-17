"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { AutonomyLog, DashboardMetrics, AutonomyAction } from "@/lib/api";

const ACTION_ICONS: Record<string, typeof Bot> = {
  provider_onboard: Database,
  pricing_adjustment: DollarSign,
  score_update: TrendingUp,
  status_report: Activity,
};

const IMPACT_STYLES: Record<string, { badge: string; icon: typeof ArrowUpRight }> = {
  positive: { badge: "badge-green", icon: ArrowUpRight },
  neutral: { badge: "badge-blue", icon: Minus },
  negative: { badge: "badge-yellow", icon: ArrowDownRight },
};

export default function AutonomyDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [logs, setLogs] = useState<AutonomyLog[]>([]);
  const [running, setRunning] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [lastActions, setLastActions] = useState<AutonomyAction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [m, l] = await Promise.all([
        fetch("/api/autonomy/dashboard").then((r) => r.json()),
        fetch("/api/autonomy/logs").then((r) => r.json()),
      ]);
      setMetrics(m);
      setLogs(l);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchData().then(() => setLoading(false));
  }, [fetchData]);

  const runCycle = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/autonomy/run-cycle", { method: "POST" });
      const data = await res.json();
      setLastActions(data.cycle_actions);
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
    const interval = setInterval(runCycle, 4000);
    return () => clearInterval(interval);
  }, [autoRun, runCycle]);

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
            <Bot className="h-7 w-7 text-brand-400" />
            <h1 className="text-3xl font-bold">Autonomy Agent</h1>
            {autoRun && (
              <span className="badge-green animate-pulse">LIVE</span>
            )}
          </div>
          <p className="text-gray-400">
            Watch the AI agent auto-onboard providers, adjust pricing, and manage the marketplace
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runCycle}
            disabled={running}
            className="btn-primary"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Cycle
          </button>
          <button
            onClick={() => setAutoRun(!autoRun)}
            className={autoRun ? "btn-primary" : "btn-secondary"}
          >
            <RefreshCw className={`h-4 w-4 ${autoRun ? "animate-spin" : ""}`} />
            {autoRun ? "Stop Auto" : "Auto Run"}
          </button>
        </div>
      </div>

      {/* Platform metrics */}
      {metrics && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Database,
              label: "Providers",
              value: metrics.total_providers,
              color: "text-blue-400",
            },
            {
              icon: Users,
              label: "Consumers",
              value: metrics.total_consumers,
              color: "text-purple-400",
            },
            {
              icon: Zap,
              label: "Total Queries",
              value: formatNumber(metrics.total_queries),
              color: "text-cyan-400",
            },
            {
              icon: DollarSign,
              label: "Total Revenue",
              value: formatCurrency(metrics.total_revenue),
              color: "text-emerald-400",
            },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="stat-card">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Revenue split bar */}
      {metrics && metrics.total_revenue > 0 && (
        <div className="mb-8 glass-card p-6">
          <h3 className="mb-4 text-sm font-semibold text-gray-400">Revenue Distribution</h3>
          <div className="flex h-8 overflow-hidden rounded-full">
            <div
              className="flex items-center justify-center bg-emerald-500/80 text-xs font-semibold"
              style={{ width: "70%" }}
            >
              Provider 70%
            </div>
            <div
              className="flex items-center justify-center bg-brand-500/80 text-xs font-semibold"
              style={{ width: "30%" }}
            >
              Platform 30%
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

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Last cycle actions */}
        <div className="lg:col-span-2">
          <div className="glass-card">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <h2 className="font-semibold">Last Cycle Actions</h2>
              <span className="badge-blue">Cycle #{cycleCount}</span>
            </div>
            <div className="p-4">
              {lastActions.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  Click &quot;Run Cycle&quot; to start the autonomy agent
                </p>
              ) : (
                <div className="space-y-3">
                  {lastActions.map((action, i) => {
                    const ActionIcon = ACTION_ICONS[action.type] || Bot;
                    const style = IMPACT_STYLES[action.impact] || IMPACT_STYLES.neutral;
                    const ImpactIcon = style.icon;
                    return (
                      <div key={i} className="rounded-lg bg-surface-200/30 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <ActionIcon className="h-4 w-4 text-brand-400" />
                          <span className={style.badge}>{action.type}</span>
                          <ImpactIcon className="ml-auto h-4 w-4 text-gray-500" />
                        </div>
                        <p className="text-sm text-gray-300">{action.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full activity log */}
        <div className="lg:col-span-3">
          <div className="glass-card">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <h2 className="font-semibold">Activity Log</h2>
              <span className="text-xs text-gray-500">{logs.length} entries</span>
            </div>
            <div className="max-h-[600px] overflow-y-auto p-4 space-y-2">
              {logs.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  No activity yet. Run some autonomy cycles!
                </p>
              ) : (
                logs.map((log) => {
                  const LogIcon = ACTION_ICONS[log.action_type] || Bot;
                  const style = IMPACT_STYLES[log.impact] || IMPACT_STYLES.neutral;
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 rounded-lg bg-surface-200/20 px-4 py-3"
                    >
                      <LogIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={style.badge}>{log.action_type}</span>
                          <span className="text-xs text-gray-600">Cycle #{log.cycle_number}</span>
                        </div>
                        <p className="text-sm text-gray-300 break-words">{log.description}</p>
                      </div>
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
