export type Platform = "facebook" | "instagram" | "tiktok" | "youtube" | "twitter";

export const PLATFORMS: {
  id: Platform;
  name: string;
  color: string;
  hasConnector: boolean;
  connectionLabel: string;
}[] = [
  { id: "facebook", name: "Facebook", color: "#1877F2", hasConnector: true, connectionLabel: "Connect Facebook Page" },
  { id: "instagram", name: "Instagram", color: "#E1306C", hasConnector: true, connectionLabel: "Connect Instagram" },
  { id: "tiktok", name: "TikTok", color: "#000000", hasConnector: true, connectionLabel: "Connect TikTok" },
  { id: "youtube", name: "YouTube", color: "#FF0000", hasConnector: true, connectionLabel: "Connect YouTube" },
  { id: "twitter", name: "X (Twitter)", color: "#1DA1F2", hasConnector: true, connectionLabel: "Connect X" },
];

export const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map((p) => [p.id, p])) as Record<Platform, (typeof PLATFORMS)[number]>;
