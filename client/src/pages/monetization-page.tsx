import { TraderProfile } from "@/components/trader-profile";
import { TraderList } from "@/components/trader-list";
import { SubscriptionList } from "@/components/subscription-list";

export default function MonetizationPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Portfolio Monetization</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <TraderProfile />
        <SubscriptionList />
      </div>
      <TraderList />
    </div>
  );
}
