import { useEffect, useRef } from "react";

declare global {
  interface Window {
    TradingView: any;
  }
}

interface StockChartProps {
  symbol: string;
}

export function StockChart({ symbol }: StockChartProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (container.current) {
        new window.TradingView.widget({
          width: "100%",
          height: 400,
          symbol: `NYSE:${symbol}`,
          interval: "D",
          timezone: "Etc/UTC",
          theme: "light",
          style: "1",
          locale: "en",
          toolbar_bg: "#f1f3f6",
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: container.current.id,
        });
      }
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [symbol]);

  return <div id={`tradingview_${symbol}`} ref={container} className="w-full h-[400px]" />;
}
