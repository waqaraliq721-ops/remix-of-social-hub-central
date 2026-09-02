import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tiktok-videos")({
  component: Outlet,
});
