"use client";

import { useState } from "react";
import type { CompanyFetchSource, CompanyLookupHit } from "@/lib/finance/company-fetch";

export function CompanyFetchPanel({
  companyName,
  cin,
  onApply,
}: {
  companyName: string;
  cin: string;
  onApply: (hit: CompanyLookupHit) => void;
}) {
  const [source, setSource] = useState<CompanyFetchSource>("mca");
  const [query, setQuery] = useState(companyName);
  const [cinQuery, setCinQuery] = useState(cin);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function fetchCompany() {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const response = await fetch("/api/finance/company-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          query: query.trim() || companyName.trim(),
          cin: cinQuery.trim() || cin.trim(),
        }),
      });
      const payload = (await response.json()) as { error?: string; company?: CompanyLookupHit };
      if (!response.ok || !payload.company) {
        setError(payload.error || "Could not fetch company information.");
        return;
      }
      onApply(payload.company);
      setNote(payload.company.note || `Loaded from ${payload.company.source === "demo" ? source : payload.company.source}.`);
      if (payload.company.name) setQuery(payload.company.name);
      if (payload.company.cin) setCinQuery(payload.company.cin);
    } catch {
      setError("Network error while fetching company information.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="company-fetch-panel">
      <p className="muted">Pull company information from Tracxn or MCA (Ministry of Corporate Affairs).</p>
      <div className="form-grid">
        <label className="field">
          <span>Source</span>
          <select value={source} onChange={(event) => setSource(event.target.value as CompanyFetchSource)}>
            <option value="mca">MCA</option>
            <option value="tracxn">Tracxn</option>
          </select>
        </label>
        <label className="field">
          <span>Company name</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name" />
        </label>
        <label className="field">
          <span>CIN</span>
          <input value={cinQuery} onChange={(event) => setCinQuery(event.target.value)} placeholder="Optional · preferred for MCA" />
        </label>
        <div className="field company-fetch-action">
          <span>&nbsp;</span>
          <button type="button" className="btn" onClick={fetchCompany} disabled={busy}>
            {busy ? "Fetching…" : "Fetch company info"}
          </button>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {note ? <p className="muted">{note}</p> : null}
    </div>
  );
}
