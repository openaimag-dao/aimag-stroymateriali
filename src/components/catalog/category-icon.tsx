import { Construction, Home, Layers, PaintBucket, Wrench, Zap, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = { Zap, PaintBucket, Layers, Construction, Wrench, Home };

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name] ?? Layers;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.7} />;
}
