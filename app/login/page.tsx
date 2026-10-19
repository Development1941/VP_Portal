import { loginAction } from "@/app/actions";
import { Logo } from "@/components/brand/logo";
import { ActionForm, Submit } from "@/components/common/forms";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { isSupabaseConfigured } from "@/lib/env";
 
const ACCOUNTS = [
  { preset: "director", role: "Director", email: "director@embee.local", note: "Full studio access" },
  { preset: "owner", role: "Project owner", email: "owner@embee.local", note: "Delivery and approvals" },
  { preset: "member", role: "Team member", email: "ishaan@embee.local", note: "Tasks and timesheets" },
];

export default function LoginPage() {
  const demo = !isSupabaseConfigured();
  return (
    <div className="login">
      <section className="poster" aria-label="Embee studio">
        <div className="poster-brand">
          <Logo />
          <span>VP Portal</span>
        </div>
        <div className="poster-copy">
          <p className="eyebrow">Studio operations</p>
          <h1>The week, the work, and the invoice. One desk.</h1>
          <p>Directors see the whole studio. Owners run delivery. The team logs the hours.</p>
        </div>
        <ul className="poster-points">
          <li>Projects, milestones, and the people on them</li>
          <li>Daily time, billable and not, then approval</li>
          <li>Rates, invoices, receipts, and team payouts</li>
        </ul>
      </section>
      <section className="login-panel">
        <ThemeToggle />
        <ActionForm action={loginAction} className="login-form">
          <div>
            <p className="eyebrow">Sign in</p>
            <h2>Welcome back</h2>
            <p className="lede">Use your studio email. Sample seats are listed under the form.</p>
          </div>
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="username" placeholder="you@studio.com" inputMode="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" placeholder="Your password" />
          </label>
          <Submit variant="block">Sign in</Submit>
          <div className="account-list">
            <p>{demo ? "Local demo. Password demo123." : "Sample studio accounts. Password demo123."}</p>
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
        </ActionForm>
      </section>
    </div>
  );
}
