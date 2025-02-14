import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortfolio } from "@/hooks/use-portfolio";
import { Tooltip, ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Cell } from "recharts";
import { useState, useMemo } from "react";

// Helper function to calculate color based on performance
function getPerformanceColor(performance: number): string {
  // Red for losses, green for gains
  if (performance < 0) {
    // Darker red for bigger losses
    const intensity = Math.min(Math.abs(performance) / 20, 1);
    return `rgba(255, 59, 48, ${0.3 + intensity * 0.7})`;
  } else {
    // Darker green for bigger gains
    const intensity = Math.min(performance / 20, 1);
    return `rgba(52, 199, 89, ${0.3 + intensity * 0.7})`;
  }
}

export function HeatmapChart() {
  const { portfolio } = usePortfolio();
  const [activeStock, setActiveStock] = useState<string | null>(null);

  const data = useMemo(() => {
    return portfolio.map((position, index) => {
      // Calculate current price with more realistic variation
      const priceVariation = Math.sin(Date.now() / 10000 + index) * 0.1; // -10% to +10%
      const currentPrice = parseFloat(position.averagePrice) * (1 + priceVariation);
      const performance = ((currentPrice - parseFloat(position.averagePrice)) / parseFloat(position.averagePrice)) * 100;
      const positionValue = parseFloat(position.shares) * currentPrice;

      return {
        x: index % 3, // Create a 3-column grid layout
        y: Math.floor(index / 3),
        z: positionValue, // Size based on position value
        symbol: position.symbol,
        shares: position.shares,
        performance,
        currentPrice: currentPrice.toFixed(2),
        averagePrice: position.averagePrice,
        value: positionValue.toFixed(2),
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
              <XAxis type="number" dataKey="x" domain={[0, 2]} hide />
              <YAxis type="number" dataKey="y" domain={[0, Math.max(2, Math.floor((data.length - 1) / 3))] } hide />
              <ZAxis type="number" dataKey="z" range={[2000, 8000]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg bg-background/95 p-3 shadow-md border">
                        <div className="font-bold text-lg mb-1">{data.symbol}</div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex justify-between gap-4">
                            <span>Value:</span>
                            <span className="font-mono">${data.value}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Shares:</span>
                            <span className="font-mono">{parseFloat(data.shares).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Current:</span>
                            <span className="font-mono">${data.currentPrice}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Average:</span>
                            <span className="font-mono">${data.averagePrice}</span>
                          </div>
                          <div className={`flex justify-between gap-4 font-medium ${
                            data.performance >= 0 ? "text-green-500" : "text-red-500"
                          }`}>
                            <span>Performance:</span>
                            <span>{data.performance >= 0 ? "+" : ""}{data.performance.toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter 
                data={data}
                onMouseEnter={(data) => setActiveStock(data.symbol)}
                onMouseLeave={() => setActiveStock(null)}
              >
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
          <div className="text-center text-muted-foreground mt-4">
            No positions in portfolio
          </div>
        )}
      </CardContent>
    </Card>
  );
}