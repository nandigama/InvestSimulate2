import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CopyTradingSettings({ traderId }: { traderId: number }) {
  const [copyAmount, setCopyAmount] = useState("100");
  const [maxPositionSize, setMaxPositionSize] = useState("1000");
  const [riskLevel, setRiskLevel] = useState("medium");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/copy-trading/settings"],
    select: (data) => data.find((s: any) => s.followedTraderId === traderId),
  });

  const { mutate: createSettings, isPending: isCreating } = useMutation({
    mutationFn: (data: any) => apiRequest("/api/copy-trading/settings", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copy-trading/settings"] });
    },
  });

  const { mutate: updateSettings, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest(`/api/copy-trading/settings/${id}`, "PUT", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copy-trading/settings"] });
    },
  });

  if (isLoading) return <div>Loading settings...</div>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      followedTraderId: traderId,
      copyAmount: parseFloat(copyAmount),
      maxPositionSize: parseFloat(maxPositionSize),
      riskLevel,
      enabled: true,
    };

    if (settings) {
      updateSettings({ id: settings.id, data });
    } else {
      createSettings(data);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Copy Trading Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Copy Amount ($)</label>
            <Input
              type="number"
              value={copyAmount}
              onChange={(e) => setCopyAmount(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Max Position Size ($)</label>
            <Input
              type="number"
              value={maxPositionSize}
              onChange={(e) => setMaxPositionSize(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Risk Level</label>
            <Select value={riskLevel} onValueChange={setRiskLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isCreating || isUpdating}>
            {settings ? "Update Settings" : "Enable Copy Trading"}
          </Button>
          {settings && (
            <Alert>
              <AlertDescription>
                Copy trading is {settings.enabled ? "enabled" : "disabled"} for this trader
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
