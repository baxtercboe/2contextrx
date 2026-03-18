"use client";

import { Shield, Lock, Fingerprint, Server } from "lucide-react";

export function HIPAAComplianceBar() {
  return (
    <footer className="border-t border-white/[0.04] bg-surface-50/50 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Shield className="h-3 w-3 text-emerald-500/70" />
          <span>Privacy by Design</span>
        </div>
        <span className="hidden sm:inline text-gray-700">|</span>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Lock className="h-3 w-3 text-brand-400/70" />
          <span>HIPAA-Aligned Architecture</span>
        </div>
        <span className="hidden sm:inline text-gray-700">|</span>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Fingerprint className="h-3 w-3 text-accent-400/70" />
          <span>PHI Never Leaves Provider</span>
        </div>
        <span className="hidden sm:inline text-gray-700">|</span>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Server className="h-3 w-3 text-cyan-400/70" />
          <span>MCP Secure Transport</span>
        </div>
      </div>
    </footer>
  );
}
