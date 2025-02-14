import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortfolio } from "@/hooks/use-portfolio";
import { Tooltip, ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Cell } from "recharts";
import { useState, useMemo } from "react";

// Helper function to calculate color based on performance
function getPerformanceColor(performance: number): string {
  // Red for losses, green for gains
  if (performance < 0) {
    // Darker red for bigger losses
    const intensity = Math.min(Math.abs(performance) / 10, 1);
    return `rgba(255, 0, 0, ${0.2 + intensity * 0.8})`;
  } else {
    // Darker green for bigger gains
    const intensity = Math.min(performance / 10, 1);
    return `rgba(0, 255, 0, ${0.2 + intensity * 0.8})`;
  }
}

export function HeatmapChart() {
  const { portfolio } = usePortfolio();
  const [activeStock, setActiveStock] = useState<string | null>(null);

  const data = useMemo(() => {
    return portfolio.map((position, index) => {
      // Mock current price between -10% and +10% of average price
      const currentPrice = parseFloat(position.averagePrice) * (0.9 + Math.random() * 0.2);
      const performance = ((currentPrice - parseFloat(position.averagePrice)) / parseFloat(position.averagePrice)) * 100;
      
      return {
        x: index % 4, // Create a grid layout, 4 items per row
        y: Math.floor(index / 4),
        z: Math.abs(performance), // Size based on absolute performance
        symbol: position.symbol,
        shares: position.shares,
        performance,
        currentPrice: currentPrice.toFixed(2),
        averagePrice: position.averagePrice,
      };
    });
  }, [portfolio]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Performance Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <XAxis type="number" dataKey="x" domain={[0, 3]} hide />
              <YAxis type="number" dataKey="y" domain={[0, Math.max(2, Math.floor((data.length - 1) / 4))] } hide />
              <ZAxis type="number" dataKey="z" range={[1000, 5000]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg bg-background/95 p-2 shadow-md border">
                        <div className="font-bold">{data.symbol}</div>
                        <div className="text-sm text-muted-foreground">
                          <div>Shares: {parseFloat(data.shares).toFixed(2)}</div>
                          <div>Current: ${data.currentPrice}</div>
                          <div>Average: ${data.averagePrice}</div>
                          <div className={data.performance >= 0 ? "text-green-500" : "text-red-500"}>
                            {data.performance >= 0 ? "+" : ""}{data.performance.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={data}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={getPerformanceColor(entry.performance)}
                    stroke={activeStock === entry.symbol ? "white" : "transparent"}
                    strokeWidth={2}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {data.length === 0 && (
          <div className="text-center text-muted-foreground">
            No positions in portfolio
          </div>
        )}
      </CardContent>
    </Card>
  );
}
