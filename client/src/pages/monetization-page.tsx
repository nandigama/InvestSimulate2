import { TraderProfile } from "@/components/trader-profile";
import { TraderList } from "@/components/trader-list";
import { SubscriptionList } from "@/components/subscription-list";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function MonetizationPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Portfolio Monetization</h1>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <TraderProfile />
        <SubscriptionList />
      </div>
      <TraderList />
    </div>
  );
}