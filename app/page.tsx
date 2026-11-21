import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const ORGS = [
  {
    href: "/finance/login",
    name: "Embee Finance",
    eyebrow: "Finance",
    blurb: "Client onboarding with Admin, Employee, and Client access.",
    points: ["Apurv / GSVK SAI · Admin", "Finance & Legal employees · allotted cases", "Clients · own company only"],
  },
  {
    href: "/login",
    name: "Embee Finsoft",
    eyebrow: "Delivery",
    blurb: "VP Portal for delivery, SOW, DSR, and escalation workflows.",
    points: ["Harshit · Director", "GSVK SAI · Admin", "Project, client, and developer profiles"],
  },
];

export default function Home() {
  return (
    <div className="org-landing">
      <header className="org-landing-top">
        <div className="poster-brand">
          <Logo />
          <span>Embee</span>
        </div>
        <ThemeToggle />
      </header>
      <main className="org-landing-main">
        <div className="org-landing-copy">
          <p className="eyebrow">Choose organization</p>
          <h1>Embee project workspaces</h1>
          <p className="lede">Pick Embee Finance or Embee Finsoft to open the matching sign-in page.</p>
        </div>
        <div className="org-grid">
          {ORGS.map((org) => (
            <Link key={org.href} href={org.href} className="org-card">
              <p className="eyebrow">{org.eyebrow}</p>
              <h2>{org.name}</h2>
              <p>{org.blurb}</p>
              <ul>
                {org.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <span className="org-card-cta">Continue to login</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
