import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { StockChart } from "@/components/stock-chart";
import { TradingPanel } from "@/components/trading-panel";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { Leaderboard } from "@/components/leaderboard";
import { LogOut } from "lucide-react";
import { HeatmapChart } from "@/components/heatmap-chart";
import { Link } from "wouter";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">PluralTrades</h1>
          <div className="flex items-center gap-4">
            <Link href="/monetization">
              <Button variant="outline">Monetization</Button>
            </Link>
            <span>Welcome, {user?.username}</span>
            <Button variant="ghost" size="icon" onClick={() => logoutMutation.mutate()}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        <PortfolioSummary />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <StockChart symbol="SPY" />
            <HeatmapChart />
            <TradingPanel />
          </div>

          <div className="space-y-6">
            <Leaderboard />
          </div>
        </div>
      </main>
    </div>
  );
}