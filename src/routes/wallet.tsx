import { createFileRoute } from "@tanstack/react-router";
import { WalletView } from "@/components/wallet-view";

export const Route = createFileRoute("/wallet")({
  component: WalletView,
});
