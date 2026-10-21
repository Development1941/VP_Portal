"use client";

import { saveStudioCurrencyAction } from "@/app/actions";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { fxLabel } from "@/lib/fx";
import type { FxRate } from "@/lib/types";

export function CurrencySwitch({ currency, editable, fx }: { currency: CurrencyCode; editable: boolean; fx?: FxRate }) {
  const note = fx ? fxLabel(fx.from, fx.rate, fx.to) : "";
  if (!editable) {
    return <span className="currency-pill" title={note}>{currency}</span>;
  }
  return (
    <form action={saveStudioCurrencyAction} className="currency-switch" title={note}>
      <label>
        <span className="sr-only">Studio currency</span>
        <select name="currency" defaultValue={currency} aria-label="Studio currency" onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          {CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>
      {note ? <span className="fx-note">{note}</span> : null}
    </form>
  );
}
