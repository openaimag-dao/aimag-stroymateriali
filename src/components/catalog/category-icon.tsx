import { Building2, Construction, Hammer, HardHat, Home, Layers, Nut, PaintBucket, PaintRoller, Wrench, Zap, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = { Zap, PaintBucket, Layers, Construction, Hammer, Wrench, Home, Building2, Nut, PaintRoller, HardHat };

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name] ?? Layers;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.7} />;
}
