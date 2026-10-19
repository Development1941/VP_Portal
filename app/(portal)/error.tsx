"use client";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="card">
      <p className="eyebrow">Portal</p>
      <h1>This page could not be loaded</h1>
      <p className="lede">{error.message || "Try the desk again."}</p>
      <button className="btn" onClick={() => reset()}>
        Try again
      </button>
    </section>
  );
}
