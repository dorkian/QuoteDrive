import type { DashboardAnalytics } from "../../lib/api";

export function makeAnalytics(
  overrides: Partial<DashboardAnalytics> = {},
): DashboardAnalytics {
  return {
    range: "12w",
    kpis: {
      open_pipeline_value: "75806.00",
      open_opportunities: 19,
      win_rate: 75,
      won: 9,
      lost: 3,
      awaiting_approval: 3,
      median_approval_hours: 9,
      ai_success_rate: 83.3,
      ai_generations: 18,
    },
    stages: [
      ["draft", 3, "0"],
      ["configured", 3, "10800"],
      ["proposal_drafted", 7, "41200"],
      ["awaiting_approval", 3, "13500"],
      ["approved", 9, "59224"],
      ["shared", 1, "5700"],
      ["won", 9, "55400"],
      ["changes_requested", 4, "9000"],
      ["lost", 3, "12000"],
      ["expired", 1, "4000"],
    ].map(([status, count, value]) => ({
      status: String(status),
      count: Number(count),
      value: String(value),
    })),
    weekly: [
      ["2026-09-14", 2, 3, "5200", 1, 6],
      ["2026-09-21", 8, 20, "89477", 13, 4],
      ["2026-09-28", 1, 3, "3000", 2, 12],
    ].map(([week_start, opps, versions, value, decided, hours]) => ({
      week_start: String(week_start),
      opportunities_created: Number(opps),
      versions_created: Number(versions),
      value_created: String(value),
      approvals_decided: Number(decided),
      median_approval_hours: Number(hours),
    })),
    packages: [
      {
        name: "Hybrid Account Manager",
        category: "hybrid",
        quantity: 80,
        value: "75300.00",
      },
      {
        name: "Electric City",
        category: "electric_city",
        quantity: 120,
        value: "72800.00",
      },
      {
        name: "Long Distance",
        category: "long_distance",
        quantity: 129,
        value: "67700.00",
      },
    ],
    ai: [
      {
        provider: "ollama",
        model: "qwen2.5:7b",
        total: 10,
        succeeded: 8,
        failed: 2,
        fallbacks: 1,
        median_latency_ms: 22000,
      },
      {
        provider: "openrouter",
        model: "gpt",
        total: 8,
        succeeded: 7,
        failed: 1,
        fallbacks: 0,
        median_latency_ms: 3800,
      },
    ],
    ...overrides,
  };
}
