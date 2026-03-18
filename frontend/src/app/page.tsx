"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Zap,
  Activity,
  Database,
  ArrowRight,
  Lock,
  Globe,
  BarChart3,
  Bot,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [provLoading, setProvLoading] = useState(false);
  const [consLoading, setConsLoading] = useState(false);

  const handleBecomeProvider = async () => {
    setProvLoading(true);
    try {
      const res = await fetch("/api/onboarding/quick-provider", { method: "POST" });
      if (res.ok) {
        router.push("/provider?onboarded=true");
      }
    } catch { /* ignore */ }
    setProvLoading(false);
  };

  const handleStartExploring = async () => {
    setConsLoading(true);
    try {
      const res = await fetch("/api/onboarding/quick-consumer", { method: "POST" });
      if (res.ok) {
        router.push("/consumer?onboarded=true");
      }
    } catch { /* ignore */ }
    setConsLoading(false);
  };

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 lg:py-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-brand-600/10 blur-[120px]" />
          <div className="absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-purple-600/10 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-300">
            <Bot className="h-4 w-4" />
            World&apos;s First Fully Autonomous Healthcare Context Marketplace
          </div>

          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight lg:text-7xl">
            <span className="gradient-text">Privacy-Preserved</span>
            <br />
            Healthcare Context
            <br />
            <span className="text-gray-400">as a Service</span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-400 leading-relaxed">
            ContextRx connects healthcare payers and hospitals with AI applications
            through standardized MCP servers. Aggregated insights flow freely —
            <strong className="text-gray-200"> raw PHI never leaves provider environments</strong>.
          </p>

          {/* One-click onboarding CTA */}
          <div className="mx-auto max-w-lg space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleBecomeProvider}
                disabled={provLoading}
                className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-purple-600 p-[1px] transition-all hover:shadow-lg hover:shadow-brand-500/25"
              >
                <div className="flex flex-col items-center gap-2 rounded-[11px] bg-surface-50/90 px-6 py-5 transition-colors group-hover:bg-surface-50/70">
                  {provLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
                  ) : (
                    <Database className="h-6 w-6 text-brand-400" />
                  )}
                  <span className="font-semibold text-sm">Become a Provider</span>
                  <span className="text-xs text-gray-500">One-click setup</span>
                </div>
              </button>

              <button
                onClick={handleStartExploring}
                disabled={consLoading}
                className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-600 to-cyan-600 p-[1px] transition-all hover:shadow-lg hover:shadow-purple-500/25"
              >
                <div className="flex flex-col items-center gap-2 rounded-[11px] bg-surface-50/90 px-6 py-5 transition-colors group-hover:bg-surface-50/70">
                  {consLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                  ) : (
                    <Zap className="h-6 w-6 text-purple-400" />
                  )}
                  <span className="font-semibold text-sm">Start Exploring</span>
                  <span className="text-xs text-gray-500">Get API key instantly</span>
                </div>
              </button>
            </div>

            <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />No signup required</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />Instant demo data</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />Full API access</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-white/[0.04] px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-3xl font-bold">How ContextRx Works</h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-gray-400">
            A two-sided marketplace powered by Model Context Protocol (MCP)
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Database,
                step: "01",
                title: "Providers Expose Context",
                desc: "Healthcare payers register MCP servers that expose pre-aggregated, k-anonymized data. No raw PHI ever leaves their environment.",
                color: "from-blue-500 to-cyan-500",
              },
              {
                icon: Globe,
                step: "02",
                title: "Central MCP Proxy Routes",
                desc: "ContextRx proxies all requests, handling authentication, metering, and billing. Every tool call is tracked and priced transparently.",
                color: "from-brand-500 to-purple-500",
              },
              {
                icon: Zap,
                step: "03",
                title: "AI Apps Consume Context",
                desc: "Consumer applications query aggregated healthcare insights via standard MCP tool calls. Pay only for what you use.",
                color: "from-purple-500 to-pink-500",
              },
            ].map(({ icon: Icon, step, title, desc, color }) => (
              <div key={title} className="glass-card p-8 relative overflow-hidden">
                <span className="absolute right-4 top-4 text-4xl font-black text-white/[0.03]">{step}</span>
                <div
                  className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${color}`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-3 text-xl font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{desc}</p>
              </div>
            ))}
          </div>

          {/* Flow arrow visualization */}
          <div className="mt-10 flex items-center justify-center gap-3 text-xs text-gray-500">
            <span className="badge-green">Provider MCP Server</span>
            <ArrowRight className="h-4 w-4" />
            <span className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-brand-300 font-semibold">
              ContextRx Proxy
            </span>
            <ArrowRight className="h-4 w-4" />
            <span className="badge-purple">Consumer AI App</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-white/[0.04] px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-4">
          {[
            { label: "Revenue Split", value: "70/30", sub: "Provider / Platform", icon: BarChart3 },
            { label: "PHI Exposure", value: "Zero", sub: "Pre-aggregated only", icon: Shield },
            { label: "Billing Model", value: "Per Call", sub: "Usage-based metering", icon: Activity },
            { label: "Autonomy", value: "Full", sub: "AI-managed operations", icon: Bot },
          ].map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="stat-card text-center">
              <Icon className="mx-auto mb-3 h-6 w-6 text-brand-400/60" />
              <p className="mb-1 text-3xl font-bold gradient-text">{value}</p>
              <p className="text-sm font-semibold text-gray-200">{label}</p>
              <p className="mt-1 text-xs text-gray-500">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Capabilities */}
      <section className="border-t border-white/[0.04] px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-center gap-2 mb-12">
            <Sparkles className="h-5 w-5 text-brand-400" />
            <h2 className="text-center text-3xl font-bold">Platform Capabilities</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Lock, label: "Privacy First", desc: "K-anonymized, aggregated data only. No raw PHI ever crosses boundaries." },
              { icon: BarChart3, label: "Real-time Metering", desc: "WebSocket-powered live billing. See cost breakdowns per query instantly." },
              { icon: Activity, label: "Performance Bonuses", desc: "Uptime, quality, volume & freshness rewards on top of the 70% base." },
              { icon: Bot, label: "Autonomy Agent", desc: "Self-managing marketplace: auto-onboards providers, adjusts pricing." },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="glass-card p-6">
                <Icon className="mb-3 h-8 w-8 text-brand-400" />
                <p className="font-semibold mb-2">{label}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/[0.04] px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Shield className="mx-auto mb-6 h-12 w-12 text-brand-400" />
          <h2 className="mb-4 text-3xl font-bold">Ready to Explore?</h2>
          <p className="mb-8 text-gray-400">
            Dive into the Provider Portal to see earnings and performance, or visit the
            Consumer Portal to run live queries against aggregated healthcare context.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/provider" className="btn-primary">
              <Database className="h-5 w-5" />
              Provider Portal
            </Link>
            <Link href="/consumer" className="btn-secondary">
              <Zap className="h-5 w-5" />
              Consumer Portal
            </Link>
            <Link href="/autonomy" className="btn-secondary">
              <Bot className="h-5 w-5" />
              Autonomy Agent
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
