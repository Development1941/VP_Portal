"use client";

import { useMemo, useState } from "react";
import { FileUp, Download } from "lucide-react";
import {
  IPO_PURPOSE_OPTIONS,
  SAMPLE_HISTORICALS,
  SAMPLE_ISSUE,
  yearLabels,
  type IpoHistoricals,
  type IpoIssueInputs,
  type IpoPurpose,
  type YearTriple,
} from "@/lib/finance/ipo-model";

function TripleInputs({
  label,
  values,
  onChange,
}: {
  label: string;
  values: YearTriple;
  onChange: (next: YearTriple) => void;
}) {
  return (
    <label className="field wide ipo-triple">
      <span>{label}</span>
      <div className="ipo-triple-inputs">
        {[0, 1, 2].map((index) => (
          <input
            key={index}
            type="number"
            step="any"
            value={Number.isFinite(values[index]) ? values[index] : 0}
            onChange={(event) => {
              const next = [...values] as YearTriple;
              next[index] = Number(event.target.value);
              onChange(next);
            }}
          />
        ))}
      </div>
    </label>
  );
}

export function IpoModelBuilder() {
  const [historical, setHistorical] = useState<IpoHistoricals>(SAMPLE_HISTORICALS);
  const [issue, setIssue] = useState<IpoIssueInputs>(SAMPLE_ISSUE);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("Sample audited numbers are loaded. Upload text PDFs to replace what can be read.");
  const [busy, setBusy] = useState<"parse" | "download" | null>(null);
  const years = useMemo(() => yearLabels(historical.lastAuditedYear), [historical.lastAuditedYear]);

  async function parsePdfs() {
    if (!files.length) {
      setNote("Choose one or more audited financial statement PDFs first.");
      return;
    }
    setBusy("parse");
    try {
      const body = new FormData();
      for (const file of files) body.append("files", file);
      const response = await fetch("/api/finance/ipo-parse", { method: "POST", body });
      const data = (await response.json()) as { error?: string; historical?: IpoHistoricals; note?: string };
      if (!response.ok) throw new Error(data.error || "Could not read the PDF.");
      if (data.historical) setHistorical(data.historical);
      setNote(data.note || "PDF read.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not read the PDF.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadModel() {
    setBusy("download");
    try {
      const response = await fetch("/api/finance/ipo-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ historical, issue }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Download failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${historical.companyName.replace(/[^\w.-]+/g, "_")}_IPO_Financial_Model.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNote("Excel model downloaded. Open in Excel — projected cells are live formulas linked across statements.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  }

  function patchIssue<K extends keyof IpoIssueInputs>(key: K, value: IpoIssueInputs[K]) {
    setIssue((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="finance-case-stack">
      <section className="card finance-intake">
        <section className="form-section">
          <h3>1. Upload audited financial statements</h3>
          <p className="muted">
            PDF with P&amp;L, Balance Sheet and Cash Flow for the last 3 years. Text PDFs only; scanned images need OCR first.
          </p>
          <div className="upload-drop ipo-drop">
            <span className="upload-mark" aria-hidden>
              <FileUp strokeWidth={1.75} />
            </span>
            <p>{files.length ? files.map((file) => file.name).join(", ") : "Drop PDF here or click to choose"}</p>
            <input
              className="upload-file"
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files || []))}
            />
            <button type="button" className="btn" disabled={busy !== null} onClick={parsePdfs}>
              {busy === "parse" ? "Reading…" : "Read PDF into historicals"}
            </button>
          </div>
          <p className="muted">{note}</p>
        </section>
      </section>

      <section className="card finance-intake">
        <section className="form-section">
          <h3>2. Historical financials</h3>
          <p className="muted">Audited numbers, oldest year first ({years.join(" · ")}). Edit any blue cell before download.</p>
          <div className="form-grid">
            <label className="field">
              <span>Company name</span>
              <input
                value={historical.companyName}
                onChange={(event) => setHistorical({ ...historical, companyName: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Last audited year (ending)</span>
              <input
                type="number"
                value={historical.lastAuditedYear}
                onChange={(event) => setHistorical({ ...historical, lastAuditedYear: Number(event.target.value) || historical.lastAuditedYear })}
              />
            </label>
            <label className="field">
              <span>Reporting units</span>
              <input value={historical.units} onChange={(event) => setHistorical({ ...historical, units: event.target.value })} />
            </label>
          </div>
          <h4>Profit &amp; loss</h4>
          <div className="ipo-year-head muted">
            <span />
            {years.map((year) => (
              <span key={year}>{year}</span>
            ))}
          </div>
          <TripleInputs label="Revenue from operations" values={historical.pnl.revenue} onChange={(revenue) => setHistorical({ ...historical, pnl: { ...historical.pnl, revenue } })} />
          <TripleInputs label="Other income" values={historical.pnl.otherIncome} onChange={(otherIncome) => setHistorical({ ...historical, pnl: { ...historical.pnl, otherIncome } })} />
          <TripleInputs label="Cost of materials / goods sold" values={historical.pnl.materials} onChange={(materials) => setHistorical({ ...historical, pnl: { ...historical.pnl, materials } })} />
          <TripleInputs label="Employee benefit expenses" values={historical.pnl.employee} onChange={(employee) => setHistorical({ ...historical, pnl: { ...historical.pnl, employee } })} />
          <TripleInputs label="Other expenses" values={historical.pnl.otherExpenses} onChange={(otherExpenses) => setHistorical({ ...historical, pnl: { ...historical.pnl, otherExpenses } })} />
          <TripleInputs label="Depreciation" values={historical.pnl.depreciation} onChange={(depreciation) => setHistorical({ ...historical, pnl: { ...historical.pnl, depreciation } })} />
          <TripleInputs label="Finance costs" values={historical.pnl.financeCosts} onChange={(financeCosts) => setHistorical({ ...historical, pnl: { ...historical.pnl, financeCosts } })} />
          <TripleInputs label="Tax expense" values={historical.pnl.tax} onChange={(tax) => setHistorical({ ...historical, pnl: { ...historical.pnl, tax } })} />

          <h4>Balance sheet</h4>
          <TripleInputs label="Net fixed assets" values={historical.bs.fixedAssets} onChange={(fixedAssets) => setHistorical({ ...historical, bs: { ...historical.bs, fixedAssets } })} />
          <TripleInputs label="Inventories" values={historical.bs.inventories} onChange={(inventories) => setHistorical({ ...historical, bs: { ...historical.bs, inventories } })} />
          <TripleInputs label="Trade receivables" values={historical.bs.receivables} onChange={(receivables) => setHistorical({ ...historical, bs: { ...historical.bs, receivables } })} />
          <TripleInputs label="Cash and bank" values={historical.bs.cash} onChange={(cash) => setHistorical({ ...historical, bs: { ...historical.bs, cash } })} />
          <TripleInputs label="Share capital" values={historical.bs.shareCapital} onChange={(shareCapital) => setHistorical({ ...historical, bs: { ...historical.bs, shareCapital } })} />
          <TripleInputs label="Reserves and surplus" values={historical.bs.reserves} onChange={(reserves) => setHistorical({ ...historical, bs: { ...historical.bs, reserves } })} />
          <TripleInputs label="Borrowings" values={historical.bs.borrowings} onChange={(borrowings) => setHistorical({ ...historical, bs: { ...historical.bs, borrowings } })} />
          <TripleInputs label="Trade payables" values={historical.bs.payables} onChange={(payables) => setHistorical({ ...historical, bs: { ...historical.bs, payables } })} />

          <h4>Cash flow (key historical lines)</h4>
          <TripleInputs label="Working capital change" values={historical.cf.wcChange} onChange={(wcChange) => setHistorical({ ...historical, cf: { ...historical.cf, wcChange } })} />
          <TripleInputs label="Internally funded capex" values={historical.cf.otherCapex} onChange={(otherCapex) => setHistorical({ ...historical, cf: { ...historical.cf, otherCapex } })} />
          <TripleInputs label="Opening cash" values={historical.cf.openingCash} onChange={(openingCash) => setHistorical({ ...historical, cf: { ...historical.cf, openingCash } })} />
        </section>
      </section>

      <section className="card finance-intake">
        <section className="form-section">
          <h3>3. IPO structure and projection drivers</h3>
          <div className="form-grid">
            <label className="field">
              <span>Purpose of the model</span>
              <select value={issue.purpose} onChange={(event) => patchIssue("purpose", event.target.value as IpoPurpose)}>
                {IPO_PURPOSE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Projection horizon</span>
              <select
                value={issue.projectionYears}
                onChange={(event) => patchIssue("projectionYears", Number(event.target.value) as 3 | 4 | 5)}
              >
                <option value={3}>3 years forward</option>
                <option value={4}>4 years forward</option>
                <option value={5}>5 years forward</option>
              </select>
            </label>
            <label className="field">
              <span>Price band floor (Rs)</span>
              <input type="number" value={issue.priceFloor} onChange={(event) => patchIssue("priceFloor", Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Price band cap (Rs)</span>
              <input type="number" value={issue.priceCap} onChange={(event) => patchIssue("priceCap", Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Issue price used (Rs)</span>
              <input type="number" value={issue.issuePrice} onChange={(event) => patchIssue("issuePrice", Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Fresh issue (Rs crore)</span>
              <input type="number" value={issue.freshIssue} onChange={(event) => patchIssue("freshIssue", Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Offer for sale (Rs crore)</span>
              <input type="number" value={issue.ofs} onChange={(event) => patchIssue("ofs", Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Issue expenses (% of issue size)</span>
              <input type="number" step="0.01" value={issue.issueExpensePct} onChange={(event) => patchIssue("issueExpensePct", Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Objects: capex % of net proceeds</span>
              <input type="number" step="0.01" value={issue.objectCapexPct} onChange={(event) => patchIssue("objectCapexPct", Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Objects: debt repayment %</span>
              <input type="number" step="0.01" value={issue.objectDebtPct} onChange={(event) => patchIssue("objectDebtPct", Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Objects: working capital %</span>
              <input type="number" step="0.01" value={issue.objectWcPct} onChange={(event) => patchIssue("objectWcPct", Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Existing capacity (units)</span>
              <input type="number" value={issue.existingCapacity} onChange={(event) => patchIssue("existingCapacity", Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Capex per new capacity unit</span>
              <input type="number" step="any" value={issue.capexPerUnit} onChange={(event) => patchIssue("capexPerUnit", Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Revenue per capacity unit @ 100%</span>
              <input type="number" step="any" value={issue.revenuePerUnit} onChange={(event) => patchIssue("revenuePerUnit", Number(event.target.value))} />
            </label>
            <label className="field">
              <span>Existing business growth Y1</span>
              <input type="number" step="0.01" value={issue.existingRevGrowth[0]} onChange={(event) => patchIssue("existingRevGrowth", [Number(event.target.value), issue.existingRevGrowth[1], issue.existingRevGrowth[2]])} />
            </label>
          </div>
          <p className="muted">
            Flow: IPO net proceeds → Capex deployed → New capacity → Utilisation × price → Incremental revenue → P&amp;L, BS, CF → DCF and comps.
          </p>
        </section>
      </section>

      <section className="card finance-intake">
        <section className="form-section">
          <h3>4. Download Excel model</h3>
          <p className="muted">
            Workbook sheets: Cover, Assumptions, IPO, Rev_Build, PnL, BS, CF, DCF, Comps. Historicals are written into input cells; projections stay as linked formulas.
          </p>
          <div className="modal-actions">
            <a className="btn ghost" href="/ipo/IPO_Financial_Model_Template.xlsx" download>
              Download blank template
            </a>
            <button type="button" className="btn" disabled={busy !== null} onClick={downloadModel}>
              <Download strokeWidth={1.75} aria-hidden size={16} />
              {busy === "download" ? "Building…" : "Download filled IPO model"}
            </button>
          </div>
        </section>
      </section>
    </div>
  );
}
