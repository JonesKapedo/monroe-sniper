import { createFileRoute } from "@tanstack/react-router";
import { TapeView } from "@/components/tape-view";

export const Route = createFileRoute("/tape")({
  component: TapeView,
});
