import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { roundMoney } from "@/lib/format";
import { PortalError } from "@/lib/form";

export type MarketBoard = {
  quotes: Record<CurrencyCode, number>;
  source: string;
  asOf: string;
};

export async function marketBoard(): Promise<MarketBoard> {
  let body: { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!response.ok) throw new Error(String(response.status));
    body = await response.json();
  } catch {
    throw new PortalError("The market rate could not be loaded. The currency was left unchanged.");
  }
  if (body.result !== "success" || !body.rates) throw new PortalError("The market rate could not be loaded. The currency was left unchanged.");
  const quotes = {} as Record<CurrencyCode, number>;
  for (const code of CURRENCIES) {
    const value = Number(body.rates[code]);
    if (!Number.isFinite(value) || value <= 0) throw new PortalError(`No market rate is published for ${code}.`);
    quotes[code] = value;
  }
  return { quotes, source: "open.er-api.com", asOf: body.time_last_update_utc || new Date().toISOString() };
}

export function crossRate(quotes: Record<CurrencyCode, number>, from: CurrencyCode, to: CurrencyCode) {
  return quotes[to] / quotes[from];
}

export function convertMoney(amount: number, rate: number) {
  if (!amount) return 0;
  return roundMoney(amount * rate);
}

export function fxLabel(from: string, rate: number, to: string) {
  const shown = rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return `1 ${from} = ${shown} ${to}`;
}
