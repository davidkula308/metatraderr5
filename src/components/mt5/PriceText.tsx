import { cn } from "@/lib/utils";

export function splitPrice(price: number, digits: number) {
  const s = price.toFixed(digits);
  if (digits >= 3) return { prefix: s.slice(0, -3), big: s.slice(-3, -1), sup: s.slice(-1) };
  return { prefix: s.slice(0, -2), big: s.slice(-2), sup: "" };
}

export function BigPrice({ price, digits, className }: { price: number; digits: number; className?: string }) {
  const { prefix, big, sup } = splitPrice(price, digits);
  return (
    <span className={cn("font-num inline-flex items-start leading-none", className)}>
      <span className="self-end text-[0.68em]">{prefix}</span>
      <span>{big}</span>
      {sup && <span className="ml-px text-[0.5em]">{sup}</span>}
    </span>
  );
}
