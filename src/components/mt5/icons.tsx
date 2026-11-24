import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

export function TradeIcon({ size = 24, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p}>
      <path d="M4 18l5-6 4 3 6-8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="4" cy="18" r="2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="13" cy="15" r="2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="7" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChartsIcon({ size = 24, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p}>
      <path d="M7 3v3M7 18v3M17 3v4M17 17v4" strokeLinecap="round" />
      <rect x="4.5" y="6" width="5" height="12" rx="1" />
      <rect x="14.5" y="7" width="5" height="10" rx="1" />
    </svg>
  );
}

export function QuotesIcon({ size = 24, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} {...p}>
      <path d="M8 20V4M4 8l4-4 4 4M16 4v16M12 16l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SpreadIcon({ size = 14, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} {...p}>
      <path d="M2 3h12M2 13h12M5 3v10M11 3v10M5 8h6" />
    </svg>
  );
}

export function OneClickIcon({ size = 26, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 24" {...p}>
      <rect x="1" y="4" width="13" height="16" rx="3" className="fill-down" />
      <rect x="14" y="4" width="13" height="16" rx="3" className="fill-up" />
      <rect x="8" y="9" width="12" height="6" rx="3" className="fill-background" />
    </svg>
  );
}

export function SymbolsIcon({ size = 26, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M12 2a10 10 0 0 1 0 20z" className="fill-up" />
      <path d="M12 2a10 10 0 0 0 0 20z" className="fill-down" />
      <circle cx="12" cy="12" r="5" className="fill-background" />
    </svg>
  );
}

export function IndicatorIcon({ size = 26, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...p}>
      <path d="M3 17c3-7 5-9 7-4s4 4 6-3 3-5 5-4" strokeLinecap="round" />
      <path d="M5 21l3-6M14 20l2-5" strokeLinecap="round" />
    </svg>
  );
}

export function Mt5Logo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path d="M6 8l9 30h6l-9-30z" className="fill-chart-4" />
      <path d="M14 8l9 30h6l-9-30z" className="fill-chart-4" opacity="0.75" />
      <path d="M36 6l-8 22 4 2 8-22z" className="fill-chart-4" opacity="0.6" />
      <circle cx="33" cy="33" r="11" className="fill-demo" />
      <circle cx="33" cy="33" r="11" className="fill-icon" opacity="0.55" />
      <text x="33" y="38.5" textAnchor="middle" fontSize="15" fontWeight="700" className="fill-background font-condensed">
        5
      </text>
    </svg>
  );
}
