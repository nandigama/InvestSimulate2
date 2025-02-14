import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { tradeSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortfolio } from "@/hooks/use-portfolio";
import type { Trade } from "@shared/schema";

export function TradingPanel() {
  const [symbol, setSymbol] = useState("AAPL");
  const { executeTrade, isTrading } = usePortfolio();

  const form = useForm<Trade>({
    resolver: zodResolver(tradeSchema),
    defaultValues: {
      symbol: "AAPL",
      shares: 1,
      type: "buy",
    },
  });

  const onSubmit = (formData: Trade) => {
    executeTrade(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade Stocks</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbol</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      onChange={e => {
                        field.onChange(e);
                        setSymbol(e.target.value.toUpperCase());
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shares"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shares</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1" 
                      step="1" 
                      {...field}
                      onChange={e => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <Button
                type="submit"
                onClick={() => form.setValue("type", "buy")}
                disabled={isTrading}
                className="w-full"
              >
                Buy
              </Button>
              <Button
                type="submit"
                onClick={() => form.setValue("type", "sell")}
                disabled={isTrading}
                variant="secondary"
                className="w-full"
              >
                Sell
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}