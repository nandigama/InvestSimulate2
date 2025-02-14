import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { usePortfolio } from "@/hooks/use-portfolio";

export function PortfolioSummary() {
  const { user } = useAuth();
  const { portfolio } = usePortfolio();

  const portfolioValue = portfolio.reduce((total, position) => {
    // Mock current price between -10% and +10% of average price
    const currentPrice = parseFloat(position.averagePrice) * (0.9 + Math.random() * 0.2);
    return total + (parseFloat(position.shares) * currentPrice);
  }, 0);

  const virtualBalance = user?.virtualBalance ? parseFloat(user.virtualBalance) : 0;
  const totalValue = virtualBalance + portfolioValue;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${virtualBalance.toFixed(2)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${portfolioValue.toFixed(2)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${totalValue.toFixed(2)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{portfolio.length}</div>
        </CardContent>
      </Card>
    </div>
  );
}