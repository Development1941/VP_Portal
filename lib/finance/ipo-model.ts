export type IpoPurpose = "price_band" | "drhp" | "both";

export type YearTriple = [number, number, number];

export type IpoHistoricals = {
  companyName: string;
  lastAuditedYear: number;
  units: string;
  pnl: {
    revenue: YearTriple;
    otherIncome: YearTriple;
    materials: YearTriple;
    employee: YearTriple;
    otherExpenses: YearTriple;
    depreciation: YearTriple;
    financeCosts: YearTriple;
    tax: YearTriple;
  };
  bs: {
    fixedAssets: YearTriple;
    investments: YearTriple;
    inventories: YearTriple;
    receivables: YearTriple;
    otherCurrentAssets: YearTriple;
    cash: YearTriple;
    shareCapital: YearTriple;
    reserves: YearTriple;
    borrowings: YearTriple;
    otherNcl: YearTriple;
    payables: YearTriple;
    otherCurrentLiab: YearTriple;
  };
  cf: {
    wcChange: YearTriple;
    taxPaid: YearTriple;
    otherCapex: YearTriple;
    otherInvesting: YearTriple;
    otherBorrowings: YearTriple;
    financePaid: YearTriple;
    dividends: YearTriple;
    otherFinancing: YearTriple;
    openingCash: YearTriple;
  };
};

export type IpoIssueInputs = {
  purpose: IpoPurpose;
  preIssueSharesCr: number;
  faceValue: number;
  priceFloor: number;
  priceCap: number;
  issuePrice: number;
  freshIssue: number;
  ofs: number;
  issueExpensePct: number;
  ipoCloseYear: number;
  objectCapexPct: number;
  objectDebtPct: number;
  objectWcPct: number;
  existingCapacity: number;
  capexPerUnit: number;
  revenuePerUnit: number;
  priceEscalation: number;
  utilY1: number;
  utilY2: number;
  utilY3: number;
  utilY4: number;
  utilY5: number;
  existingRevGrowth: YearTriple; // projection years 1-3 shown; y4/y5 derived
  projectionYears: 3 | 4 | 5;
};

export const IPO_PURPOSE_OPTIONS: { value: IpoPurpose; label: string }[] = [
  { value: "price_band", label: "IPO price band" },
  { value: "drhp", label: "Projection model for DRHP / prospectus" },
  { value: "both", label: "Both price band and DRHP projections" },
];

export const SAMPLE_HISTORICALS: IpoHistoricals = {
  companyName: "Sample Industries Limited",
  lastAuditedYear: 2025,
  units: "Rs crore",
  pnl: {
    revenue: [412, 498, 585],
    otherIncome: [4.2, 5.1, 6.3],
    materials: [248, 298, 348],
    employee: [38, 45, 52],
    otherExpenses: [42, 50, 58],
    depreciation: [14, 17, 20],
    financeCosts: [12, 13.5, 14],
    tax: [15.7, 20, 25],
  },
  bs: {
    fixedAssets: [180, 215, 262],
    investments: [12, 14, 16],
    inventories: [52, 63, 74],
    receivables: [68, 83, 98],
    otherCurrentAssets: [18, 22, 26],
    cash: [25, 34, 52],
    shareCapital: [20, 20, 20],
    reserves: [140, 194.6, 261.9],
    borrowings: [110, 113.4, 125.1],
    otherNcl: [6, 7, 8],
    payables: [48, 58, 68],
    otherCurrentLiab: [31, 38, 45],
  },
  cf: {
    wcChange: [-9, -13, -13],
    taxPaid: [-15.7, -20, -25],
    otherCapex: [-45, -52, -67],
    otherInvesting: [-3, -2, -2],
    otherBorrowings: [7.5, 3.4, 11.7],
    financePaid: [-12, -13.5, -14],
    dividends: [-3, -5, -7],
    otherFinancing: [0, 1, 1],
    openingCash: [17, 25, 34],
  },
};

export const SAMPLE_ISSUE: IpoIssueInputs = {
  purpose: "both",
  preIssueSharesCr: 5,
  faceValue: 10,
  priceFloor: 380,
  priceCap: 400,
  issuePrice: 400,
  freshIssue: 400,
  ofs: 150,
  issueExpensePct: 0.06,
  ipoCloseYear: 1,
  objectCapexPct: 0.55,
  objectDebtPct: 0.2,
  objectWcPct: 0.1,
  existingCapacity: 100,
  capexPerUnit: 5,
  revenuePerUnit: 7,
  priceEscalation: 0.03,
  utilY1: 0,
  utilY2: 0.45,
  utilY3: 0.65,
  utilY4: 0.8,
  utilY5: 0.85,
  existingRevGrowth: [0.18, 0.16, 0.145],
  projectionYears: 5,
};

export function yearLabels(lastAuditedYear: number) {
  return [
    `FY${lastAuditedYear - 2}A`,
    `FY${lastAuditedYear - 1}A`,
    `FY${lastAuditedYear}A`,
  ];
}

export function purposeLabel(purpose: IpoPurpose) {
  return IPO_PURPOSE_OPTIONS.find((item) => item.value === purpose)?.label || purpose;
}
