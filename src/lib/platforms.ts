export type Platform = "facebook" | "instagram" | "tiktok" | "youtube" | "twitter";

export const PLATFORMS: {
  id: Platform;
  name: string;
  color: string; // tailwind-safe hex used only for accents/badges
  hasConnector: boolean;
}[] = [
  { id: "facebook", name: "Facebook", color: "#1877F2", hasConnector: false },
  { id: "instagram", name: "Instagram", color: "#E1306C", hasConnector: false },
  { id: "tiktok", name: "TikTok", color: "#000000", hasConnector: true },
  { id: "youtube", name: "YouTube", color: "#FF0000", hasConnector: false },
  { id: "twitter", name: "X (Twitter)", color: "#1DA1F2", hasConnector: true },
];

export const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map((p) => [p.id, p])) as Record<
  Platform,
  (typeof PLATFORMS)[number]
>;
