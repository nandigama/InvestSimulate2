import { useQuery, useMutation } from "@tanstack/react-query";
import { UpdateTrader, User, Subscription } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useTrader() {
  const { toast } = useToast();

  const { data: traders = [] } = useQuery<User[]>({
    queryKey: ["/api/traders"],
  });

  const { data: subscriptions = [] } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
  });

  const updateTraderProfileMutation = useMutation({
    mutationFn: async (update: UpdateTrader) => {
      const res = await apiRequest("POST", "/api/trader/profile", update);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile updated",
        description: "Your trader profile has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (traderId: number) => {
      const res = await apiRequest("POST", "/api/subscribe", { traderId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({
        title: "Subscription successful",
        description: "You are now subscribed to this trader",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Subscription failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: number) => {
      await apiRequest("POST", `/api/subscription/${subscriptionId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({
        title: "Subscription cancelled",
        description: "Your subscription has been cancelled",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    traders,
    subscriptions,
    updateTraderProfile: updateTraderProfileMutation.mutate,
    isUpdatingProfile: updateTraderProfileMutation.isPending,
    subscribe: subscribeMutation.mutate,
    isSubscribing: subscribeMutation.isPending,
    cancelSubscription: cancelSubscriptionMutation.mutate,
    isCancelling: cancelSubscriptionMutation.isPending,
  };
}
