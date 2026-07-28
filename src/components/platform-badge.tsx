import { Facebook, Instagram, Youtube, Twitter, Music2 } from "lucide-react";
import type { Platform } from "@/lib/platforms";
import { PLATFORM_MAP } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const ICON = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  twitter: Twitter,
} as const;

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const Icon = ICON[platform];
  return <Icon className={cn("h-4 w-4", className)} style={{ color: PLATFORM_MAP[platform].color }} />;
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  const p = PLATFORM_MAP[platform];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: `${p.color}40`, color: p.color, backgroundColor: `${p.color}10` }}
    >
      <PlatformIcon platform={platform} className="h-3 w-3" />
      {p.name}
    </span>
  );
}
