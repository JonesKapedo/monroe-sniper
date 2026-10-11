import { createFileRoute } from "@tanstack/react-router";
import { LearnView } from "@/components/learn-view";

export const Route = createFileRoute("/learn")({
  component: LearnView,
});
