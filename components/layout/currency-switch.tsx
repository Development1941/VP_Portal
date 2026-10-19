"use client";

import { saveStudioCurrencyAction } from "@/app/actions";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";

export function CurrencySwitch({ currency, editable }: { currency: CurrencyCode; editable: boolean }) {
  if (!editable) {
    return <span className="currency-pill">{currency}</span>;
  }
  return (
    <form action={saveStudioCurrencyAction} className="currency-switch">
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
    </form>
  );
}
