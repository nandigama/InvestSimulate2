import { useTrader } from "@/hooks/use-trader";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

export function TraderList() {
  const { user } = useAuth();
  const { traders, subscriptions, subscribe, isSubscribing } = useTrader();

  const isSubscribed = (traderId: number) => {
    return subscriptions.some(sub => sub.traderId === traderId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Traders</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trader</TableHead>
              <TableHead>Bio</TableHead>
              <TableHead>Monthly Fee</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {traders
              .filter(trader => trader.id !== user?.id)
              .map(trader => (
                <TableRow key={trader.id}>
                  <TableCell className="font-medium">{trader.username}</TableCell>
                  <TableCell className="max-w-md truncate">{trader.bio}</TableCell>
                  <TableCell>${trader.monthlySubscriptionFee}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={isSubscribed(trader.id) ? "secondary" : "default"}
                      disabled={isSubscribed(trader.id) || isSubscribing}
                      onClick={() => subscribe(trader.id)}
                    >
                      {isSubscribed(trader.id) ? "Subscribed" : "Subscribe"}
                    </Button>
                  </TableCell>
                </TableRow>
            ))}
            {traders.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No traders available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
