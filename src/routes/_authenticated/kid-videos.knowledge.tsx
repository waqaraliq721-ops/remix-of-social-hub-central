import { createFileRoute } from "@tanstack/react-router";
import { KidQuizStudio } from "@/components/kid-quiz-studio";

export const Route = createFileRoute("/_authenticated/kid-videos/knowledge")({
  head: () => ({ meta: [{ title: "General Knowledge Quiz Videos — Orbit" }, { name: "description", content: "Create animated general knowledge quiz videos with timed reveals and audio." }, { property: "og:title", content: "General Knowledge Quiz Videos — Orbit" }, { property: "og:description", content: "Build polished animated knowledge quiz videos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <KidQuizStudio kind="knowledge" />,
});