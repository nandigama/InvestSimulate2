import { useQuery, useMutation } from "@tanstack/react-query";
import { Portfolio, Transaction, Trade } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function usePortfolio() {
  const { toast } = useToast();

  const { data: portfolio = [] } = useQuery<Portfolio[]>({
    queryKey: ["/api/portfolio"],
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const tradeMutation = useMutation({
    mutationFn: async (trade: Trade) => {
      const res = await apiRequest("POST", "/api/trade", trade);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Trade executed successfully",
        description: "Your portfolio has been updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Trade failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: leaderboard = [] } = useQuery<
    Array<{ username: string; totalValue: number }>
  >({
    queryKey: ["/api/leaderboard"],
  });

  return {
    portfolio,
    transactions,
    leaderboard,
    executeTrade: tradeMutation.mutate,
    isTrading: tradeMutation.isPending,
  };
}
