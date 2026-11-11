import { loginAction } from "@/app/actions";
import { Logo } from "@/components/brand/logo";
import { ActionForm, Submit } from "@/components/common/forms";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { isSupabaseConfigured } from "@/lib/env";
 
const ACCOUNTS = [
  { preset: "director", role: "Director / Super admin", email: "director@embee.local", note: "Harshit Bansal" },
  { preset: "owner", role: "Admin", email: "owner@embee.local", note: "GSVK SAI" },
  { preset: "manager", role: "Project Manager / PO", email: "manav@embee.local", note: "Manav Singal" },
  { preset: "scrum", role: "Scrum Master", email: "sm@embee.local", note: "Kaushik" },
  { preset: "yuvraj", role: "Developer", email: "yuvraj@embee.local", note: "Yuvraj" },
  { preset: "client", role: "Client", email: "rakhee@embee.local", note: "Rakhee" },
  { preset: "brian", role: "Client", email: "brian@embee.local", note: "Brian" },
  { preset: "member", role: "Developer", email: "ishaan@embee.local", note: "Bhuvin Singla" },
];

export default function LoginPage() {
  const demo = !isSupabaseConfigured();
  return (
    <div className="login">
      <section className="poster" aria-label="Embee">
        <div className="poster-brand">
          <Logo />
          <span>VP Portal</span>
        </div>
        <div className="poster-copy">
          <p className="eyebrow">Embee</p>
          <h1>Project delivery and operations</h1>
          <p>Intake, delivery, time, and billing for your organization.</p>
        </div>
        <ul className="poster-points">
          <li>Projects, milestones, and assigned teams</li>
          <li>Daily status reports and approvals</li>
          <li>Rates, invoices, receipts, and payouts</li>
        </ul>
      </section>
      <section className="login-panel">
        <ThemeToggle />
        <ActionForm action={loginAction} className="login-form">
          <div>
            <p className="eyebrow">Sign in</p>
            <h2>Welcome back</h2>
            <p className="lede">Sign in with your work email.</p>
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
            <p>{demo ? "Demo accounts" : "Organization accounts"}</p>
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
