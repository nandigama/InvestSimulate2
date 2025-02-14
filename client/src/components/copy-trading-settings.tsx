import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CopyTradingSettings as CopyTradingSettingsType } from "@shared/schema";

interface Props {
  traderId: number;
}

type CopyTradingSettingsData = {
  followedTraderId: number;
  copyAmount: number;
  maxPositionSize: number;
  riskLevel: "low" | "medium" | "high";
  enabled: boolean;
};

export function CopyTradingSettings({ traderId }: Props) {
  const [copyAmount, setCopyAmount] = useState("100");
  const [maxPositionSize, setMaxPositionSize] = useState("1000");
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">("medium");

  const { data: settings, isLoading } = useQuery<CopyTradingSettingsType[]>({
    queryKey: ["/api/copy-trading/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/copy-trading/settings");
      return res.json();
    }
  });

  const activeSetting = settings?.find((s) => s.followedTraderId === traderId);

  const { mutate: createSettings, isPending: isCreating } = useMutation({
    mutationFn: async (data: CopyTradingSettingsData) => {
      const res = await apiRequest("POST", "/api/copy-trading/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copy-trading/settings"] });
    },
  });

  const { mutate: updateSettings, isPending: isUpdating } = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CopyTradingSettingsData> }) => {
      const res = await apiRequest("PUT", `/api/copy-trading/settings/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/copy-trading/settings"] });
    },
  });

  if (isLoading) return <div>Loading settings...</div>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: CopyTradingSettingsData = {
      followedTraderId: traderId,
      copyAmount: parseFloat(copyAmount),
      maxPositionSize: parseFloat(maxPositionSize),
      riskLevel,
      enabled: true,
    };

    if (activeSetting) {
      updateSettings({ id: activeSetting.id, data });
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
            {activeSetting ? "Update Settings" : "Enable Copy Trading"}
          </Button>
          {activeSetting && (
            <Alert>
              <AlertDescription>
                Copy trading is {activeSetting.enabled ? "enabled" : "disabled"} for this trader
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}