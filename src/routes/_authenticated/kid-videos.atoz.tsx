import { createFileRoute } from "@tanstack/react-router";
import { KidQuizStudio } from "@/components/kid-quiz-studio";

export const Route = createFileRoute("/_authenticated/kid-videos/atoz")({
  head: () => ({ meta: [{ title: "From A to Z Videos — Orbit" }, { name: "description", content: "Create animated A-to-Z challenge videos with ranked answer reveals." }, { property: "og:title", content: "From A to Z Videos — Orbit" }, { property: "og:description", content: "Build polished letter challenge videos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <KidQuizStudio kind="atoz" />,
});