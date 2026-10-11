import { createFileRoute } from "@tanstack/react-router";
import { OpportunitiesView } from "@/components/opportunities-view";

export const Route = createFileRoute("/opportunities")({
  component: OpportunitiesView,
});
