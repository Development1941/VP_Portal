export function Logo({ className = "logo" }: { className?: string }) {
  return <img src="/embee-logo.webp" alt="Embee" className={className} width={593} height={231} />;
}

export function BrandLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="brand-loader" role="status" aria-label={label}>
      <div className="loader-mark">
        <Logo />
        <span className="loader-scan" />
      </div>
      <span className="loader-bar">
        <i />
      </span>
    </div>
  );
}
