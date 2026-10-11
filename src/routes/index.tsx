import { createFileRoute } from "@tanstack/react-router";
import { DeskView } from "@/components/desk-view";

export const Route = createFileRoute("/")({
  component: DeskView,
});
