import { createFileRoute } from "@tanstack/react-router";
import { KidQuizStudio } from "@/components/kid-quiz-studio";

export const Route = createFileRoute("/_authenticated/kid-videos/sound")({
  head: () => ({ meta: [{ title: "Guess The Sound Videos — Orbit" }, { name: "description", content: "Create interactive guess-the-sound videos with timed reveals and audio controls." }, { property: "og:title", content: "Guess The Sound Videos — Orbit" }, { property: "og:description", content: "Build polished audio guessing videos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <KidQuizStudio kind="sound" />,
});