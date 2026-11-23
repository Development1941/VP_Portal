import type { FinanceCapacityRow } from "@/lib/finance/types";
import { emptyCapacityRow } from "@/lib/finance/capacity";

export type CompanyFetchSource = "tracxn" | "mca";

export type CompanyLookupHit = {
  source: CompanyFetchSource | "demo";
  name: string;
  cin: string;
  pan: string;
  constitution: string;
  incorporationYear: string;
  locations: string;
  businessDescription: string;
  keyClients: string;
  capacityRows: Array<Pick<FinanceCapacityRow, "product" | "capacity" | "unit">>;
  people: Array<{ name: string; role: string }>;
  note?: string;
};

type DemoCompany = CompanyLookupHit;

const DEMO_COMPANIES: DemoCompany[] = [
  {
    source: "demo",
    name: "Lifeline",
    cin: "U85110MH2018PTC312001",
    pan: "AABCL1234A",
    constitution: "Private Limited",
    incorporationYear: "2018",
    locations: "Mumbai, Maharashtra",
    businessDescription: "Healthcare services and specialty clinics preparing for an SME IPO.",
    keyClients: "Hospital networks, insurers",
    capacityRows: [
      { product: "OPD consultations", capacity: "120000", unit: "Units / year" },
      { product: "Inpatient beds", capacity: "180", unit: "Beds" },
    ],
    people: [
      { name: "Nikhil Mehta", role: "Promoter" },
      { name: "Anurag", role: "Director" },
    ],
  },
  {
    source: "demo",
    name: "Jija Mata Green Energy Limited",
    cin: "U40106MH2021PLC358442",
    pan: "AADCJ9876B",
    constitution: "Private Limited",
    incorporationYear: "2021",
    locations: "Pune, Maharashtra",
    businessDescription: "Renewable energy generation and green power project development.",
    keyClients: "Discoms, industrial offtakers",
    capacityRows: [
      { product: "Solar generation", capacity: "25", unit: "MW" },
      { product: "Biomass processing", capacity: "40000", unit: "MTPA" },
    ],
    people: [{ name: "Ravi Patil", role: "Promoter" }],
  },
  {
    source: "demo",
    name: "Tata Consultancy Services Limited",
    cin: "L22210MH1995PLC084781",
    pan: "AAACT1111A",
    constitution: "Public Limited",
    incorporationYear: "1995",
    locations: "Mumbai, Maharashtra",
    businessDescription: "IT services, consulting and business solutions.",
    keyClients: "Global enterprises",
    capacityRows: [{ product: "Delivery seats", capacity: "600000", unit: "Units" }],
    people: [],
  },
  {
    source: "demo",
    name: "Infosys Limited",
    cin: "L85110KA1981PLC013115",
    pan: "AAACI1234B",
    constitution: "Public Limited",
    incorporationYear: "1981",
    locations: "Bengaluru, Karnataka",
    businessDescription: "Digital services and consulting.",
    keyClients: "Fortune 500 clients",
    capacityRows: [{ product: "Delivery seats", capacity: "320000", unit: "Units" }],
    people: [],
  },
];

function normalizeQuery(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchDemo(query: string, cin: string): DemoCompany | null {
  const q = normalizeQuery(query);
  const c = cin.trim().toUpperCase();
  if (c) {
    const byCin = DEMO_COMPANIES.find((item) => item.cin.toUpperCase() === c);
    if (byCin) return byCin;
  }
  if (!q) return null;
  return (
    DEMO_COMPANIES.find((item) => normalizeQuery(item.name) === q) ||
    DEMO_COMPANIES.find((item) => normalizeQuery(item.name).includes(q) || q.includes(normalizeQuery(item.name))) ||
    null
  );
}

function yearFromDate(value: unknown) {
  const text = String(value || "");
  const match = text.match(/(19|20)\d{2}/);
  return match?.[0] || "";
}

async function fetchTracxnLive(query: string, cin: string): Promise<CompanyLookupHit | null> {
  const token = process.env.TRACXN_ACCESS_TOKEN?.trim();
  if (!token) return null;

  const filter: Record<string, unknown> = {
    and: [{ companyLocation: [{ country: { is: ["India"] } }] }],
  };
  if (cin.trim()) {
    (filter.and as unknown[]).push({ companyLegalName: { is: [query || cin] } });
  } else if (query.trim()) {
    (filter.and as unknown[]).push({ companyName: { is: [query.trim()] } });
  } else {
    return null;
  }

  try {
    const response = await fetch("https://platform.tracxn.com/api/2.2/companies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Access Token ${token}`,
      },
      body: JSON.stringify({
        filter,
        dataset: "query",
        page: 0,
        size: 1,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      result?: Array<{
        name?: string;
        domainProfile?: { domainName?: string };
        description?: string;
        foundedYear?: number | string;
        location?: Array<{ city?: string; state?: string; country?: string }>;
        companyStage?: string;
      }>;
    };
    const first = payload.result?.[0];
    if (!first?.name) return null;
    const location = first.location?.[0];
    return {
      source: "tracxn",
      name: first.name,
      cin: cin.trim().toUpperCase(),
      pan: "",
      constitution: "Private Limited",
      incorporationYear: String(first.foundedYear || ""),
      locations: [location?.city, location?.state, location?.country].filter(Boolean).join(", "),
      businessDescription: first.description || "",
      keyClients: "",
      capacityRows: [emptyCapacityRow()],
      people: [],
      note: "Filled from Tracxn API.",
    };
  } catch {
    return null;
  }
}

async function fetchMcaLive(query: string, cin: string): Promise<CompanyLookupHit | null> {
  const filesureKey = process.env.FILESUR_API_KEY?.trim() || process.env.MCA_API_KEY?.trim();
  const normalizedCin = cin.trim().toUpperCase();

  if (filesureKey && normalizedCin) {
    try {
      const response = await fetch(`https://api.filesure.in/v1/companies/${encodeURIComponent(normalizedCin)}`, {
        headers: { "x-api-key": filesureKey },
        signal: AbortSignal.timeout(12000),
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          data?: {
            companyName?: string;
            cin?: string;
            companyCategory?: string;
            companySubCategory?: string;
            dateOfIncorporation?: string;
            registeredAddress?: string | { fullAddress?: string };
            companyStatus?: string;
          };
        };
        const data = payload.data;
        if (data?.companyName || data?.cin) {
          const address =
            typeof data.registeredAddress === "string"
              ? data.registeredAddress
              : data.registeredAddress?.fullAddress || "";
          const constitution = /public/i.test(String(data.companyCategory || data.companySubCategory || ""))
            ? "Public Limited"
            : "Private Limited";
          return {
            source: "mca",
            name: data.companyName || query,
            cin: data.cin || normalizedCin,
            pan: "",
            constitution,
            incorporationYear: yearFromDate(data.dateOfIncorporation),
            locations: address,
            businessDescription: data.companyStatus ? `MCA status: ${data.companyStatus}` : "",
            keyClients: "",
            capacityRows: [emptyCapacityRow()],
            people: [],
            note: "Filled from MCA via FileSure API.",
          };
        }
      }
    } catch {
      /* fall through */
    }
  }

  const infynerKey = process.env.INFYNER_API_KEY?.trim();
  if (infynerKey) {
    try {
      const searchUrl = normalizedCin
        ? `https://api.infyner.com/v1/companies/${encodeURIComponent(normalizedCin)}`
        : `https://api.infyner.com/v1/companies/search?q=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${infynerKey}`, "x-api-key": infynerKey },
        signal: AbortSignal.timeout(12000),
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          data?: {
            name?: string;
            companyName?: string;
            cin?: string;
            incorporationDate?: string;
            registeredOffice?: string;
            address?: string;
            companyType?: string;
          };
          results?: Array<{ name?: string; cin?: string }>;
        };
        const data = payload.data || (payload.results?.[0] ? { name: payload.results[0].name, cin: payload.results[0].cin } : null);
        if (data && (data.name || data.companyName || data.cin)) {
          return {
            source: "mca",
            name: data.companyName || data.name || query,
            cin: (data.cin || normalizedCin).toUpperCase(),
            pan: "",
            constitution: /public/i.test(String(data.companyType || "")) ? "Public Limited" : "Private Limited",
            incorporationYear: yearFromDate(data.incorporationDate),
            locations: data.registeredOffice || data.address || "",
            businessDescription: "",
            keyClients: "",
            capacityRows: [emptyCapacityRow()],
            people: [],
            note: "Filled from MCA-linked Infyner API.",
          };
        }
      }
    } catch {
      /* fall through */
    }
  }

  return null;
}

function demoAsSource(hit: DemoCompany, source: CompanyFetchSource): CompanyLookupHit {
  return {
    ...hit,
    source,
    note:
      source === "tracxn"
        ? "Demo Tracxn-style company profile (set TRACXN_ACCESS_TOKEN for live Tracxn)."
        : "Demo MCA-style company master data (set FILESUR_API_KEY or INFYNER_API_KEY for live MCA).",
  };
}

export async function lookupCompanyOnline(input: {
  source: CompanyFetchSource;
  query: string;
  cin?: string;
}): Promise<CompanyLookupHit> {
  const query = input.query.trim();
  const cin = (input.cin || "").trim().toUpperCase();
  if (!query && !cin) {
    throw new Error("Enter a company name or CIN to fetch.");
  }

  if (input.source === "tracxn") {
    const live = await fetchTracxnLive(query, cin);
    if (live) return live;
    const demo = matchDemo(query, cin);
    if (demo) return demoAsSource(demo, "tracxn");
    throw new Error("No Tracxn match found. Try another name, or add TRACXN_ACCESS_TOKEN for live search.");
  }

  const liveMca = await fetchMcaLive(query, cin);
  if (liveMca) return liveMca;
  const demo = matchDemo(query, cin);
  if (demo) return demoAsSource(demo, "mca");

  if (cin && /^[A-Z]{1}\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(cin)) {
    return {
      source: "mca",
      name: query || `Company ${cin.slice(-6)}`,
      cin,
      pan: "",
      constitution: cin.startsWith("L") ? "Public Limited" : "Private Limited",
      incorporationYear: cin.slice(8, 12),
      locations: "",
      businessDescription: "CIN format validated locally. Connect an MCA API key for full master data.",
      keyClients: "",
      capacityRows: [emptyCapacityRow()],
      people: [],
      note: "Synthetic MCA stub from CIN pattern (no live MCA key configured).",
    };
  }

  throw new Error("No MCA match found. Provide a valid CIN, or add FILESUR_API_KEY / INFYNER_API_KEY for live MCA.");
}
