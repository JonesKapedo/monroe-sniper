import { createFileRoute } from "@tanstack/react-router";
import { SignalsView } from "@/components/signals-view";

export const Route = createFileRoute("/signals")({
  component: SignalsView,
});
