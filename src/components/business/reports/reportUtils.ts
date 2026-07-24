import type { SalesRow } from "@/lib/supabase/orders";
import type { LotStock } from "@/lib/supabase/business";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Period = "monthly" | "quarterly" | "half_yearly" | "yearly";
export type SubTab = "per_day" | "party_wise" | "item_wise" | "deep_analysis";

export const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "half_yearly", label: "Half-Yearly" },
  { key: "yearly", label: "Yearly" },
];

export const SUB_TABS: Array<{ key: SubTab; label: string }> = [
  { key: "per_day", label: "Per Day" },
  { key: "party_wise", label: "Party-Wise" },
  { key: "item_wise", label: "Item-Wise" },
  { key: "deep_analysis", label: "Deep Analysis" },
];

// ---------------------------------------------------------------------------
// Period bounds
// ---------------------------------------------------------------------------

/** Local YYYY-MM-DD matching how order_date is stored. */
function localISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns inclusive [start, end] ISO date bounds for the given period + cursor. */
export function periodBounds(
  cursor: Date,
  period: Period
): { start: string; end: string } {
  const y = cursor.getFullYear();
  const m = cursor.getMonth();

  if (period === "monthly") {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0); // last day of month
    return { start: localISODate(start), end: localISODate(end) };
  }

  if (period === "quarterly") {
    const qStart = Math.floor(m / 3) * 3;
    const start = new Date(y, qStart, 1);
    const end = new Date(y, qStart + 3, 0);
    return { start: localISODate(start), end: localISODate(end) };
  }

  if (period === "half_yearly") {
    const hStart = m < 6 ? 0 : 6;
    const start = new Date(y, hStart, 1);
    const end = new Date(y, hStart + 6, 0);
    return { start: localISODate(start), end: localISODate(end) };
  }

  // yearly
  const start = new Date(y, 0, 1);
  const end = new Date(y, 11, 31);
  return { start: localISODate(start), end: localISODate(end) };
}

/** Shift the cursor forward/backward by one period unit. */
export function shiftPeriod(cursor: Date, period: Period, dir: 1 | -1): Date {
  const d = new Date(cursor);
  if (period === "monthly") d.setMonth(d.getMonth() + dir);
  else if (period === "quarterly") d.setMonth(d.getMonth() + dir * 3);
  else if (period === "half_yearly") d.setMonth(d.getMonth() + dir * 6);
  else d.setFullYear(d.getFullYear() + dir);
  return d;
}

/** Human-readable label for the current period. */
export function periodLabel(cursor: Date, period: Period): string {
  const y = cursor.getFullYear();
  const m = cursor.getMonth();

  if (period === "monthly") {
    const name = new Date(y, m, 1).toLocaleDateString("en-IN", {
      month: "long",
    });
    return `${name} ${y}`;
  }
  if (period === "quarterly") {
    const q = Math.floor(m / 3) + 1;
    return `Q${q} ${y}`;
  }
  if (period === "half_yearly") {
    return m < 6 ? `H1 ${y}` : `H2 ${y}`;
  }
  return `${y}`;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export const rupees = (n: number): string =>
  `₹${Math.round(n).toLocaleString("en-IN")}`;

export const metres = (n: number): string =>
  `${Math.round(n).toLocaleString("en-IN")}m`;

/** "12 Jun 2026" style date for tables. */
export function longDate(iso: string): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "12 Jun" short date for chart x-axis. */
export function chartDate(iso: string): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/** Filter orders to the given period bounds. */
export function filterByPeriod(
  rows: SalesRow[],
  cursor: Date,
  period: Period
): SalesRow[] {
  const { start, end } = periodBounds(cursor, period);
  return rows.filter((r) => r.orderDate >= start && r.orderDate <= end);
}

// ---------------------------------------------------------------------------
// Per-Day aggregation
// ---------------------------------------------------------------------------

export interface DayData {
  date: string;
  orders: number;
  totalMetres: number;
  totalAmount: number;
}

/** Aggregate orders by date, filling in zero-order days. */
export function aggregateByDay(
  rows: SalesRow[],
  cursor: Date,
  period: Period
): DayData[] {
  const { start, end } = periodBounds(cursor, period);
  const map = new Map<string, DayData>();

  for (const r of rows) {
    const existing = map.get(r.orderDate);
    if (existing) {
      existing.orders += 1;
      existing.totalMetres += r.totalMetres;
      existing.totalAmount += r.totalAmount;
    } else {
      map.set(r.orderDate, {
        date: r.orderDate,
        orders: 1,
        totalMetres: r.totalMetres,
        totalAmount: r.totalAmount,
      });
    }
  }

  // Fill in zero-order days
  const allDays: string[] = [];
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    allDays.push(localISODate(d));
  }

  return allDays.map((date) => {
    const existing = map.get(date);
    return (
      existing ?? { date, orders: 0, totalMetres: 0, totalAmount: 0 }
    );
  });
}

// ---------------------------------------------------------------------------
// Party-Wise aggregation
// ---------------------------------------------------------------------------

export interface PartyData {
  partyName: string;
  orders: number;
  totalMetres: number;
  totalAmount: number;
  pctOfPeriod: number;
}

export function aggregateByParty(rows: SalesRow[]): PartyData[] {
  const map = new Map<string, PartyData>();
  const grandTotal = rows.reduce((sum, r) => sum + r.totalAmount, 0);

  for (const r of rows) {
    const existing = map.get(r.partyName);
    if (existing) {
      existing.orders += 1;
      existing.totalMetres += r.totalMetres;
      existing.totalAmount += r.totalAmount;
    } else {
      map.set(r.partyName, {
        partyName: r.partyName,
        orders: 1,
        totalMetres: r.totalMetres,
        totalAmount: r.totalAmount,
        pctOfPeriod: 0,
      });
    }
  }

  const parties = [...map.values()]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .map((p, i) => ({
      ...p,
      rank: i + 1,
      pctOfPeriod: grandTotal > 0 ? (p.totalAmount / grandTotal) * 100 : 0,
    }));

  return parties;
}

// ---------------------------------------------------------------------------
// Item-Wise aggregation
// ---------------------------------------------------------------------------

export interface ItemData {
  itemName: string;
  activeLots: number;
  metresSold: number;
  amount: number;
  avgRate: number;
  pctOfTotal: number;
}

export function aggregateByItem(
  rows: SalesRow[],
  allLots: LotStock[]
): ItemData[] {
  const map = new Map<string, ItemData>();
  const grandTotal = rows.reduce((sum, r) => sum + r.totalAmount, 0);

  // Count active lots per item name
  const lotCounts = new Map<string, number>();
  for (const lot of allLots) {
    if (
      lot.status === "active" ||
      lot.status === "arrived" ||
      lot.status === "low_stock"
    ) {
      lotCounts.set(lot.itemName, (lotCounts.get(lot.itemName) ?? 0) + 1);
    }
  }

  for (const r of rows) {
    const existing = map.get(r.itemName);
    if (existing) {
      existing.metresSold += r.totalMetres;
      existing.amount += r.totalAmount;
    } else {
      map.set(r.itemName, {
        itemName: r.itemName,
        activeLots: 0,
        metresSold: r.totalMetres,
        amount: r.totalAmount,
        avgRate: 0,
        pctOfTotal: 0,
      });
    }
  }

  return [...map.values()]
    .map((item) => ({
      ...item,
      activeLots: lotCounts.get(item.itemName) ?? 0,
      avgRate: item.metresSold > 0 ? item.amount / item.metresSold : 0,
      pctOfTotal: grandTotal > 0 ? (item.amount / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

// ---------------------------------------------------------------------------
// Deep Analysis helpers
// ---------------------------------------------------------------------------

export interface DeepAnalysisData {
  // Section A: What produced this
  totalLots: number;
  lotsContributed: number;
  deadStockLots: number;
  avgSalePerLot: number;

  totalMetresSold: number;
  avgRevenuePerMetre: number;
  fastestClearingLot: { name: string; days: number } | null;
  slowestClearingLot: { name: string; days: number; unsoldPct: number } | null;

  activePartiesThisPeriod: number;
  top3Parties: { name: string; amount: number; pct: number }[];
  partiesWhoDidntOrder: number;
  avgOrderValue: number;

  workingDays: number;
  daysWithOrders: number;
  avgDailySaleActiveDays: number;
  bestDay: { date: string; amount: number; orders: number } | null;

  totalOrders: number;
  avgMetresPerOrder: number;
  avgOrderValue2: number;
  gstOrders: number;
  gstPct: number;
  nonGstOrders: number;

  // Section B: Targets
  targetAmount: number;
  minLotsNeeded: number;
  targetMetres: number;
  activePartiesNeeded: number;
  ordersNeeded: number;
  avgOrdersPerDay: number;

  // Insights
  insights: string[];
  topLeverage: string;
}

export function computeDeepAnalysis(
  rows: SalesRow[],
  allLots: LotStock[],
  cursor: Date,
  period: Period
): DeepAnalysisData {
  const totalAmount = rows.reduce((sum, r) => sum + r.totalAmount, 0);
  const totalMetres = rows.reduce((sum, r) => sum + r.totalMetres, 0);
  const totalOrders = rows.length;

  // Lots
  const lotsWithOrders = new Set(rows.map((r) => r.dNo)).size;
  const deadLots = allLots.filter((l) => l.status === "dead_stock").length;
  const avgSalePerLot = lotsWithOrders > 0 ? totalAmount / lotsWithOrders : 0;

  // Metres
  const avgRevenuePerMetre = totalMetres > 0 ? totalAmount / totalMetres : 0;

  // Fastest / slowest clearing lot
  const lotMap = new Map<
    string,
    { name: string; arrived: string; remaining: number; opening: number }
  >();
  for (const lot of allLots) {
    const totalRemaining =
      lot.top.remaining + lot.bottom.remaining + lot.dupatta.remaining;
    const totalOpening =
      lot.top.opening + lot.bottom.opening + lot.dupatta.opening;
    lotMap.set(lot.lotId, {
      name: lot.itemName + (lot.dNo ? ` (${lot.dNo})` : ""),
      arrived: lot.dateArrived,
      remaining: totalRemaining,
      opening: totalOpening,
    });
  }

  // Lots that had orders, sorted by arrival date
  const lotsInPeriod = [...lotMap.values()].filter(
    (l) => l.opening > 0 && l.remaining < l.opening
  );

  let fastestClearing: { name: string; days: number } | null = null;
  let slowestClearing: { name: string; days: number; unsoldPct: number } | null =
    null;

  if (lotsInPeriod.length > 0) {
    const now = new Date();
    const lotDays = lotsInPeriod.map((l) => {
      const arrived = new Date(`${l.arrived}T00:00:00`);
      const days = Math.max(
        1,
        Math.round((now.getTime() - arrived.getTime()) / 86_400_000)
      );
      return { ...l, days };
    });
    lotDays.sort((a, b) => a.days - b.days);
    fastestClearing = {
      name: lotDays[0].name,
      days: lotDays[0].days,
    };
    const slow = lotDays[lotDays.length - 1];
    slowestClearing = {
      name: slow.name,
      days: slow.days,
      unsoldPct:
        slow.opening > 0
          ? Math.round((slow.remaining / slow.opening) * 100)
          : 0,
    };
  }

  // Parties
  const partySet = new Set(rows.map((r) => r.partyName));
  const allParties = new Set(allLots.length > 0 ? [] : []);
  // For parties who didn't order, we'd need the full party master. Use approximation.
  const partyAmounts = new Map<string, number>();
  for (const r of rows) {
    partyAmounts.set(
      r.partyName,
      (partyAmounts.get(r.partyName) ?? 0) + r.totalAmount
    );
  }
  const top3 = [...partyAmounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, amount]) => ({
      name,
      amount,
      pct: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
    }));

  // Days
  const dayMap = new Map<string, { orders: number; amount: number }>();
  for (const r of rows) {
    const d = dayMap.get(r.orderDate) ?? { orders: 0, amount: 0 };
    d.orders += 1;
    d.amount += r.totalAmount;
    dayMap.set(r.orderDate, d);
  }
  const { start, end } = periodBounds(cursor, period);
  let workingDays = 0;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    workingDays += 1;
  }
  const daysWithOrders = dayMap.size;
  const avgDailySale =
    daysWithOrders > 0 ? totalAmount / daysWithOrders : 0;

  let bestDay: { date: string; amount: number; orders: number } | null = null;
  for (const [date, data] of dayMap) {
    if (!bestDay || data.amount > bestDay.amount) {
      bestDay = { date, amount: data.amount, orders: data.orders };
    }
  }

  // GST
  const gstOrders = rows.filter((r) => r.gstAmount > 0).length;
  const nonGstOrders = totalOrders - gstOrders;

  // Targets for next period
  const avgOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;
  const avgMetresPerOrder = totalOrders > 0 ? totalMetres / totalOrders : 0;
  const avgOrdersPerDay =
    workingDays > 0 ? totalOrders / workingDays : 0;

  // Insights
  const insights: string[] = [];
  const items = aggregateByItem(rows, allLots);
  if (items.length > 0 && totalAmount > 0) {
    const topItem = items[0];
    if (topItem.pctOfTotal > 30) {
      const compensateLots = Math.ceil(
        (topItem.pctOfTotal / 100) * (totalAmount * 0.1) /
          (avgSalePerLot || 1)
      );
      insights.push(
        `${topItem.itemName} was ${Math.round(topItem.pctOfTotal)}% of your sale. If it underperforms, you need ~${compensateLots} extra lot${compensateLots !== 1 ? "s" : ""} of other items to compensate.`
      );
    }
  }

  if (top3.length >= 2) {
    const names = top3
      .slice(0, 2)
      .map((p) => p.name)
      .join(" and ");
    insights.push(
      `Your top ${top3.length > 3 ? "3" : top3.length} parties drove ${Math.round(top3.reduce((s, p) => s + p.pct, 0))}% of revenue. Prioritise visits to ${names} in the first week.`
    );
  }

  if (bestDay && daysWithOrders < workingDays) {
    const zeroDays = workingDays - daysWithOrders;
    insights.push(
      `You had ${zeroDays} zero-order day${zeroDays !== 1 ? "s" : ""}. Reducing from ${zeroDays} to ${Math.max(0, zeroDays - 2)} at your avg daily rate adds ${rupees(avgDailySale * Math.min(2, zeroDays))}.`
    );
  }

  if (slowestClearing && slowestClearing.unsoldPct > 20) {
    insights.push(
      `${slowestClearing.name} has ${slowestClearing.unsoldPct}% unsold. Clearing this adds directly to sale without a new lot.`
    );
  }

  // Single highest leverage
  let topLeverage = "";
  if (top3.length >= 2 && top3[0].pct + top3[1].pct > 30) {
    const visitNames = top3
      .slice(0, 2)
      .map((p) => p.name)
      .join(", ");
    topLeverage = `Visit ${visitNames} in the first days of next period. These ${top3.length > 2 ? "3" : 2} alone can deliver ${Math.round(top3.reduce((s, p) => s + p.pct, 0))}% of your target before the period is a week old.`;
  } else if (daysWithOrders < workingDays) {
    topLeverage = `You have ${workingDays - daysWithOrders} zero-order days. Getting one order on each adds ${rupees(avgOrderValue * (workingDays - daysWithOrders))} — the easiest revenue lift.`;
  } else {
    topLeverage = `Your average order value is ${rupees(avgOrderValue)}. One extra order per party per period adds ${rupees(avgOrderValue * partySet.size)}.`;
  }

  return {
    totalLots: allLots.length,
    lotsContributed: lotsWithOrders,
    deadStockLots: deadLots,
    avgSalePerLot,
    totalMetresSold: totalMetres,
    avgRevenuePerMetre,
    fastestClearingLot: fastestClearing,
    slowestClearingLot: slowestClearing,
    activePartiesThisPeriod: partySet.size,
    top3Parties: top3,
    partiesWhoDidntOrder: 0, // can't compute without full party master
    avgOrderValue,
    workingDays,
    daysWithOrders,
    avgDailySaleActiveDays: avgDailySale,
    bestDay,
    totalOrders,
    avgMetresPerOrder,
    avgOrderValue2: avgOrderValue,
    gstOrders,
    gstPct: totalOrders > 0 ? (gstOrders / totalOrders) * 100 : 0,
    nonGstOrders,
    targetAmount: totalAmount,
    minLotsNeeded: Math.ceil(totalAmount / (avgSalePerLot || 1)),
    targetMetres: totalMetres,
    activePartiesNeeded: partySet.size,
    ordersNeeded: totalOrders,
    avgOrdersPerDay,
    insights,
    topLeverage,
  };
}

// ---------------------------------------------------------------------------
// Export text generation
// ---------------------------------------------------------------------------

export function generateExportText(
  rows: SalesRow[],
  allLots: LotStock[],
  cursor: Date,
  period: Period,
  subTab: SubTab
): string {
  const label = periodLabel(cursor, period);
  const { start, end } = periodBounds(cursor, period);
  const lines: string[] = [];

  lines.push(`REPORTS — ${subTab.replace("_", " ").toUpperCase()}`);
  lines.push(`Period: ${label} (${start} to ${end})`);
  lines.push(`Generated: ${new Date().toLocaleDateString("en-IN")}`);
  lines.push("");

  if (subTab === "per_day") {
    const days = aggregateByDay(filterByPeriod(rows, cursor, period), cursor, period);
    const totalOrders = days.reduce((s, d) => s + d.orders, 0);
    const totalMetres = days.reduce((s, d) => s + d.totalMetres, 0);
    const totalAmount = days.reduce((s, d) => s + d.totalAmount, 0);
    lines.push(`Total Orders: ${totalOrders}`);
    lines.push(`Total Metres: ${metres(totalMetres)}`);
    lines.push(`Total Amount: ${rupees(totalAmount)}`);
    lines.push("");
    lines.push("Date              | Orders | Metres | Amount");
    lines.push("-".repeat(55));
    for (const d of days) {
      if (d.orders === 0) {
        lines.push(`${longDate(d.date).padEnd(17)} |      — |      — |      —`);
      } else {
        lines.push(
          `${longDate(d.date).padEnd(17)} | ${String(d.orders).padStart(6)} | ${metres(d.totalMetres).padStart(6)} | ${rupees(d.totalAmount).padStart(6)}`
        );
      }
    }
  } else if (subTab === "party_wise") {
    const parties = aggregateByParty(filterByPeriod(rows, cursor, period));
    const totalOrders = parties.reduce((s, p) => s + p.orders, 0);
    const totalAmount = parties.reduce((s, p) => s + p.totalAmount, 0);
    lines.push(`${parties.length} parties · ${totalOrders} orders · ${rupees(totalAmount)} total`);
    lines.push("");
    lines.push("Rank | Party              | Orders | Metres | Amount    | %");
    lines.push("-".repeat(70));
    parties.forEach((p, i) => {
      lines.push(
        `${String(i + 1).padStart(4)} | ${p.partyName.padEnd(18)} | ${String(p.orders).padStart(6)} | ${metres(p.totalMetres).padStart(6)} | ${rupees(p.totalAmount).padStart(9)} | ${p.pctOfPeriod.toFixed(1)}%`
      );
    });
  } else if (subTab === "item_wise") {
    const items = aggregateByItem(filterByPeriod(rows, cursor, period), allLots);
    const totalAmount = items.reduce((s, i) => s + i.amount, 0);
    lines.push(`Total: ${rupees(totalAmount)}`);
    lines.push("");
    lines.push("Item               | Lots | Metres | Amount    | Avg Rate | %");
    lines.push("-".repeat(70));
    for (const item of items) {
      lines.push(
        `${item.itemName.padEnd(18)} | ${String(item.activeLots).padStart(4)} | ${metres(item.metresSold).padStart(6)} | ${rupees(item.amount).padStart(9)} | ${rupees(item.avgRate).padStart(8)} | ${item.pctOfTotal.toFixed(1)}%`
      );
    }
  } else {
    // deep analysis
    const data = computeDeepAnalysis(rows, allLots, cursor, period);
    lines.push(`WHAT PRODUCED ${rupees(data.targetAmount).toUpperCase()}`);
    lines.push("");
    lines.push(`Lots: ${data.totalLots} total · ${data.lotsContributed} contributed · ${data.deadStockLots} dead stock`);
    lines.push(`Metres: ${metres(data.totalMetresSold)} total · ${rupees(data.avgRevenuePerMetre)}/m avg`);
    lines.push(`Parties: ${data.activePartiesThisPeriod} active`);
    lines.push(`Orders: ${data.totalOrders} total · ${data.avgMetresPerOrder.toFixed(0)}m avg · ${rupees(data.avgOrderValue)} avg value`);
    lines.push("");
    lines.push("INSIGHTS:");
    for (const insight of data.insights) {
      lines.push(`• ${insight}`);
    }
    lines.push("");
    lines.push("HIGHEST LEVERAGE:");
    lines.push(data.topLeverage);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Export trigger
// ---------------------------------------------------------------------------

export function triggerExport(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
