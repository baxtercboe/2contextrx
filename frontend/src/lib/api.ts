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

// Autonomy APIs
export const runAutonomyCycle = () =>
  fetchAPI<{ cycle_actions: AutonomyAction[]; action_count: number }>("/autonomy/run-cycle", {
    method: "POST",
  });
export const getAutonomyLogs = () => fetchAPI<AutonomyLog[]>("/autonomy/logs");
export const getDashboardMetrics = () => fetchAPI<DashboardMetrics>("/autonomy/dashboard");

// Types
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

export interface Transaction {
  id: number;
  provider_id: number;
  consumer_id: number;
  tool_name: string;
  cost: number;
  provider_payout: number;
  platform_fee: number;
  latency_ms: number;
  status: string;
  created_at: string;
}

export interface MCPQueryRequest {
  tool_name: string;
  consumer_id: number;
  parameters: Record<string, unknown>;
}

export interface MCPQueryResponse {
  tool_name: string;
  result: Record<string, unknown>;
  cost: number;
  provider_payout: number;
  platform_fee: number;
  latency_ms: number;
  phi_disclaimer: string;
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
  total_consumers: number;
  total_queries: number;
  total_revenue: number;
  platform_earnings: number;
  provider_payouts: number;
  avg_latency_ms: number;
  uptime_percent: number;
}
