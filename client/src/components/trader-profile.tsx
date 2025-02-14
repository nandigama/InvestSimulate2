import { useAuth } from "@/hooks/use-auth";
import { useTrader } from "@/hooks/use-trader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateTraderSchema } from "@shared/schema";
import type { UpdateTrader } from "@shared/schema";

export function TraderProfile() {
  const { user } = useAuth();
  const { updateTraderProfile, isUpdatingProfile } = useTrader();

  const form = useForm<UpdateTrader>({
    resolver: zodResolver(updateTraderSchema),
    defaultValues: {
      monthlySubscriptionFee: user?.monthlySubscriptionFee ? parseFloat(user.monthlySubscriptionFee) : 0,
      bio: user?.bio || "",
    },
  });

  const onSubmit = (data: UpdateTrader) => {
    updateTraderProfile(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trader Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="monthlySubscriptionFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Subscription Fee ($)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="0" 
                      max="100" 
                      step="0.01" 
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tell others about your trading strategy..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isUpdatingProfile}>
              {user?.isTrader ? "Update Profile" : "Become a Trader"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
