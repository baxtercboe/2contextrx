const API_BASE = "/api";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "API request failed");
  }
  return res.json();
}

// Provider APIs
export const getProviders = () => fetchAPI<Provider[]>("/providers/");
export const getProvider = (id: number) => fetchAPI<Provider>(`/providers/${id}`);
export const getProviderTools = (id: number) => fetchAPI<MCPTool[]>(`/providers/${id}/tools`);
export const getProviderTransactions = (id: number) =>
  fetchAPI<Transaction[]>(`/providers/${id}/transactions`);
export const simulatePayout = (data: PayoutSimRequest) =>
  fetchAPI<PayoutSimulation>("/providers/simulate-payout", {
    method: "POST",
    body: JSON.stringify(data),
  });

// Consumer APIs
export const getConsumers = () => fetchAPI<Consumer[]>("/consumers/");
export const getConsumerTransactions = (id: number) =>
  fetchAPI<Transaction[]>(`/consumers/${id}/transactions`);

// MCP Proxy APIs
export const getCatalog = () => fetchAPI<MCPTool[]>("/mcp/catalog");
export const executeQuery = (data: MCPQueryRequest) =>
  fetchAPI<MCPQueryResponse>("/mcp/query", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const mcpInvoke = (data: MCPInvokeRequest) =>
  fetchAPI<MCPQueryResponse>("/mcp/invoke", {
    method: "POST",
    body: JSON.stringify(data),
  });

// Onboarding APIs
export const quickRegisterProvider = () =>
  fetchAPI<Provider>("/onboarding/quick-provider", { method: "POST" });
export const quickRegisterConsumer = () =>
  fetchAPI<Consumer>("/onboarding/quick-consumer", { method: "POST" });

// Provider extras
export const registerProvider = (data: ProviderCreateRequest) =>
  fetchAPI<Provider>("/providers/", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const getEarningsHistory = (id: number) =>
  fetchAPI<EarningsHistory>(`/providers/${id}/earnings-history`);

// Autonomy APIs
export const runAutonomyCycle = () =>
  fetchAPI<AgentCycleResult>("/autonomy/run-cycle", { method: "POST" });
export const getAutonomyLogs = (limit?: number) =>
  fetchAPI<AutonomyLog[]>(`/autonomy/logs${limit ? `?limit=${limit}` : ""}`);
export const getDashboardMetrics = () => fetchAPI<DashboardMetrics>("/autonomy/dashboard");
export const getAgentTools = () => fetchAPI<AgentToolDef[]>("/autonomy/tools");
export const getTakeRate = () => fetchAPI<TakeRateInfo>("/autonomy/take-rate");

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Provider {
  id: number;
  name: string;
  organization: string;
  mcp_endpoint: string;
  api_key: string;
  status: string;
  data_domains: string;
  uptime_score: number;
  quality_score: number;
  total_earnings: number;
  created_at: string;
}

export interface Consumer {
  id: number;
  name: string;
  organization: string;
  api_key: string;
  plan: string;
  total_spent: number;
  query_count: number;
  created_at: string;
}

export interface MCPTool {
  id: number;
  provider_id: number;
  name: string;
  description: string;
  input_schema: string;
  price_per_call: number;
  category: string;
  call_count: number;
  avg_latency_ms: number;
  is_active: boolean;
}

export interface CostBreakdown {
  base_cost: number;
  complexity_multiplier: number;
  volume_multiplier: number;
  final_cost: number;
  formula: string;
}

export interface RewardBreakdown {
  provider_base_payout: number;
  uptime_bonus: number;
  quality_bonus: number;
  total_provider_payout: number;
  platform_fee: number;
  formula: string;
}

export interface Transaction {
  id: number;
  provider_id: number;
  consumer_id: number;
  tool_name: string;
  session_id: string | null;
  base_cost: number;
  complexity_multiplier: number;
  volume_multiplier: number;
  cost: number;
  provider_base_payout: number;
  uptime_bonus: number;
  quality_bonus: number;
  provider_payout: number;
  platform_fee: number;
  latency_ms: number;
  status: string;
  routed_to_endpoint: string | null;
  created_at: string;
}

export interface MCPInvokeRequest {
  tool_name: string;
  consumer_id: number;
  parameters: Record<string, unknown>;
  session_id?: string;
}

export interface MCPQueryRequest {
  tool_name: string;
  consumer_id: number;
  parameters: Record<string, unknown>;
  session_id?: string;
}

export interface MCPQueryResponse {
  tool_name: string;
  result: Record<string, unknown>;
  cost: number;
  cost_breakdown: CostBreakdown;
  reward_breakdown: RewardBreakdown;
  provider_payout: number;
  platform_fee: number;
  latency_ms: number;
  routed_to: string;
  session_id: string | null;
  phi_disclaimer: string;
  privacy_badges: string[];
}

export interface PayoutSimRequest {
  monthly_queries: number;
  uptime_score: number;
  quality_score: number;
  price_per_call: number;
}

export interface PayoutSimulation {
  base_payout: number;
  uptime_bonus: number;
  quality_bonus: number;
  volume_bonus: number;
  freshness_bonus: number;
  total_payout: number;
  platform_fee: number;
}

// ─── Autonomy Agent Types ────────────────────────────────────────────────────

export interface AgentThought {
  step: number;
  thought: string;
  tool: string | null;
  tool_input: Record<string, unknown>;
  observation: string;
  action_taken: string;
  impact: string;
  timestamp: string;
}

export interface AgentCycleResult {
  cycle_number: number;
  thoughts: AgentThought[];
  actions_taken: number;
  total_steps: number;
  platform_take_rate: number;
  summary: string;
  started_at: string;
  completed_at: string;
  // Legacy compat
  cycle_actions: AutonomyAction[];
  action_count: number;
}

export interface AutonomyAction {
  type: string;
  description: string;
  impact: string;
}

export interface AutonomyLog {
  id: number;
  cycle_number: number;
  action_type: string;
  description: string;
  details: string;
  impact: string;
  created_at: string;
}

export interface DashboardMetrics {
  total_providers: number;
  active_providers: number;
  total_consumers: number;
  total_queries: number;
  total_revenue: number;
  platform_earnings: number;
  provider_payouts: number;
  avg_latency_ms: number;
  uptime_percent: number;
  platform_take_rate: number;
}

export interface AgentToolDef {
  name: string;
  description: string;
  parameters: string[];
}

export interface TakeRateInfo {
  take_rate: number;
  take_rate_pct: number;
  provider_share_pct: number;
}

export interface ProviderCreateRequest {
  name: string;
  organization: string;
  mcp_endpoint: string;
  data_domains: string[];
}

export interface EarningsHistory {
  provider_id: number;
  total_earnings: number;
  transaction_count: number;
  data: EarningsDataPoint[];
}

export interface EarningsDataPoint {
  index: number;
  earning: number;
  cumulative: number;
  tool: string;
  timestamp: string;
}

// WebSocket meter event types
export interface MeterEvent {
  type: "transaction" | "autonomy_update" | "connected" | "pong" | "error";
  transaction_id?: number;
  tool_name?: string;
  consumer_id?: number;
  consumer_name?: string;
  provider_id?: number;
  provider_name?: string;
  cost_breakdown?: CostBreakdown;
  reward_breakdown?: RewardBreakdown;
  latency_ms?: number;
  routed_to?: string;
  result?: Record<string, unknown>;
  timestamp?: string;
  // For autonomy_update
  actions?: AutonomyAction[];
  // For connected/pong
  active_connections?: number;
  // For error
  detail?: string;
}
