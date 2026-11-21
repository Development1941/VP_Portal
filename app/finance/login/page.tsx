import Link from "next/link";
import { financeLoginAction } from "@/app/finance/actions";
import { Logo } from "@/components/brand/logo";
import { ActionForm, Submit } from "@/components/common/forms";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const ACCOUNTS = [
  { preset: "apurv", role: "Admin", email: "apurv@finance.embee.local", note: "Apurv · Director" },
  { preset: "gsvk", role: "Admin", email: "gsvk@finance.embee.local", note: "GSVK SAI" },
  { preset: "vishal", role: "Employee · Finance", email: "vishal@finance.embee.local", note: "Vishal" },
  { preset: "ashish", role: "Employee · Finance", email: "ashish@finance.embee.local", note: "Ashish" },
  { preset: "deepak", role: "Employee · Finance", email: "deepak@finance.embee.local", note: "Deepak" },
  { preset: "meera", role: "Employee · Legal", email: "meera@finance.embee.local", note: "Meera Shah" },
  { preset: "rohan", role: "Employee · Legal", email: "rohan@finance.embee.local", note: "Rohan Desai" },
  { preset: "lifeline", role: "Client", email: "nikhil@lifeline.client.local", note: "Nikhil · Lifeline" },
  { preset: "jija", role: "Client", email: "ravi@jijamata.client.local", note: "Ravi · Jija Mata" },
];

export default function FinanceLoginPage() {
  return (
    <div className="login">
      <section className="poster" aria-label="Embee Finance">
        <div className="poster-brand">
          <Logo />
          <span>Embee Finance</span>
        </div>
        <div className="poster-copy">
          <p className="eyebrow">Client onboarding</p>
          <h1>Admin, employee, and client access</h1>
          <p>Debt, equity, and insolvency cases with allotment, mandate/NDA, and client-only company views.</p>
        </div>
        <ul className="poster-points">
          <li>Admin adds clients and allots cases</li>
          <li>Employees see allotted clients only</li>
          <li>Clients see their own company only</li>
        </ul>
      </section>
      <section className="login-panel">
        <ThemeToggle />
        <ActionForm action={financeLoginAction} className="login-form">
          <div>
            <p className="eyebrow">Sign in</p>
            <h2>Embee Finance</h2>
            <p className="lede">Choose a profile from the access matrix.</p>
          </div>
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="username" placeholder="name@company.com" inputMode="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" placeholder="Your password" />
          </label>
          <Submit variant="block">Sign in</Submit>
          <div className="account-list">
            <p>Demo accounts</p>
            {ACCOUNTS.map((account) => (
              <button key={account.preset} className="account" name="preset" value={account.preset}>
                <span>
                  <strong>{account.role}</strong>
                  <small>{account.note}</small>
                </span>
                <em>{account.email}</em>
              </button>
            ))}
          </div>
          <p className="muted">
            <Link href="/">Back to organization picker</Link>
          </p>
        </ActionForm>
      </section>
    </div>
  );
}
