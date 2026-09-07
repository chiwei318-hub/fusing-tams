/**
 * Minimal Admin intake for commercial_trip_cost_rates (NORMAL PATH writer).
 * Displays engine-matching fields only — no client-side cost invent.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl, authHeaders } from "@/lib/api";

type MatchLevel = 1 | 2 | 3;

interface RateItem {
  id: number;
  customerId: number;
  matchLevel: number;
  originCity: string | null;
  originDistrict: string | null;
  destinationCity: string | null;
  destinationDistrict: string | null;
  vehicleType: string;
  serviceType: string | null;
  standardDriverTripCost: string | number;
  active: boolean;
  blockFallthrough: boolean;
  notes: string | null;
}

interface CustomerRow {
  id: number;
  name: string;
  phone?: string | null;
}

const LEVEL_HELP: Record<MatchLevel, string> = {
  1: "L1：客戶 + 起訖縣市/行政區 + 車型（可選服務）",
  2: "L2：客戶 + 起訖縣市 + 車型（行政區留空）",
  3: "L3：客戶 + 車型預設（起訖全部留空）",
};

export default function CommercialTripCostRatesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [matchLevel, setMatchLevel] = useState<MatchLevel>(1);
  const [customerId, setCustomerId] = useState<string>("");
  const [vehicleType, setVehicleType] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [originDistrict, setOriginDistrict] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationDistrict, setDestinationDistrict] = useState("");
  const [standardDriverTripCost, setStandardDriverTripCost] = useState("");
  const [notes, setNotes] = useState("");
  const [blockFallthrough, setBlockFallthrough] = useState(false);

  const customersQ = useQuery({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const r = await fetch(getApiUrl("/api/customers"), { headers: authHeaders() });
      if (!r.ok) throw new Error("customers load failed");
      return r.json() as Promise<CustomerRow[]>;
    },
  });

  const ratesQ = useQuery({
    queryKey: ["/api/commercial-trip-cost-rates"],
    queryFn: async () => {
      const r = await fetch(getApiUrl("/api/commercial-trip-cost-rates"), { headers: authHeaders() });
      if (!r.ok) throw new Error("rates load failed");
      const j = await r.json();
      return (j.items ?? []) as RateItem[];
    },
  });

  const customers = customersQ.data ?? [];
  const customerLabel = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of customers) m.set(c.id, `${c.name} (#${c.id})`);
    return m;
  }, [customers]);

  const createMut = useMutation({
    mutationFn: async () => {
      const cost = Number(standardDriverTripCost);
      if (!customerId) throw new Error("請選擇客戶");
      if (!vehicleType.trim()) throw new Error("車型必填");
      if (!Number.isFinite(cost) || cost <= 0) throw new Error("標準司機趟次成本必須 > 0");

      const body: Record<string, unknown> = {
        customerId: Number(customerId),
        matchLevel,
        vehicleType: vehicleType.trim(),
        serviceType: serviceType.trim() || null,
        standardDriverTripCost: cost,
        blockFallthrough,
        notes: notes.trim() || null,
        active: true,
      };
      if (matchLevel === 1) {
        body.originCity = originCity.trim() || null;
        body.originDistrict = originDistrict.trim() || null;
        body.destinationCity = destinationCity.trim() || null;
        body.destinationDistrict = destinationDistrict.trim() || null;
      } else if (matchLevel === 2) {
        body.originCity = originCity.trim() || null;
        body.destinationCity = destinationCity.trim() || null;
        body.originDistrict = null;
        body.destinationDistrict = null;
      } else {
        body.originCity = null;
        body.originDistrict = null;
        body.destinationCity = null;
        body.destinationDistrict = null;
      }

      const r = await fetch(getApiUrl("/api/commercial-trip-cost-rates"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "建立失敗");
      return j;
    },
    onSuccess: () => {
      toast({ title: "商業趟次成本費率已建立" });
      setStandardDriverTripCost("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["/api/commercial-trip-cost-rates"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(getApiUrl(`/api/commercial-trip-cost-rates/${id}`), {
        method: "DELETE",
        headers: authHeaders(),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "刪除失敗");
      return j;
    },
    onSuccess: () => {
      toast({ title: "已刪除費率" });
      qc.invalidateQueries({ queryKey: ["/api/commercial-trip-cost-rates"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4" data-testid="commercial-trip-cost-rates-tab">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">商業趟次成本費率（STANDARD_DRIVER_TRIP_COST）</CardTitle>
          <p className="text-xs text-muted-foreground">
            供非 Shopee 訂單的成本引擎比對。不填假數字；成本必須 &gt; 0。未知欄位請留空。
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
            {LEVEL_HELP[matchLevel]}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">客戶 *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger data-testid="ctcr-customer" className="h-9 mt-1">
                  <SelectValue placeholder="選擇客戶" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} · {c.phone ?? "—"} (#{c.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">匹配層級 *</Label>
              <Select
                value={String(matchLevel)}
                onValueChange={(v) => setMatchLevel(Number(v) as MatchLevel)}
              >
                <SelectTrigger data-testid="ctcr-match-level" className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">L1 行政區 OD</SelectItem>
                  <SelectItem value="2">L2 縣市 OD</SelectItem>
                  <SelectItem value="3">L3 客戶+車型預設</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">車型 *</Label>
              <Input
                data-testid="ctcr-vehicle"
                className="h-9 mt-1"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                placeholder="例：箱型車"
              />
            </div>

            <div>
              <Label className="text-xs">服務類型（可空＝NULL 預設）</Label>
              <Input
                data-testid="ctcr-service"
                className="h-9 mt-1"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                placeholder="留空 = 通用預設"
              />
            </div>

            <div>
              <Label className="text-xs">標準司機趟次成本 *</Label>
              <Input
                data-testid="ctcr-cost"
                className="h-9 mt-1"
                type="number"
                min={0.01}
                step="0.01"
                value={standardDriverTripCost}
                onChange={(e) => setStandardDriverTripCost(e.target.value)}
                placeholder="必須 &gt; 0"
              />
            </div>

            <div>
              <Label className="text-xs">備註（可空）</Label>
              <Input
                data-testid="ctcr-notes"
                className="h-9 mt-1"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {matchLevel <= 2 && (
              <>
                <div>
                  <Label className="text-xs">起點縣市{matchLevel === 1 ? " *" : " *"}</Label>
                  <Input
                    data-testid="ctcr-origin-city"
                    className="h-9 mt-1"
                    value={originCity}
                    onChange={(e) => setOriginCity(e.target.value)}
                    placeholder="例：台北市"
                  />
                </div>
                {matchLevel === 1 && (
                  <div>
                    <Label className="text-xs">起點行政區 *</Label>
                    <Input
                      data-testid="ctcr-origin-district"
                      className="h-9 mt-1"
                      value={originDistrict}
                      onChange={(e) => setOriginDistrict(e.target.value)}
                      placeholder="例：中山區"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-xs">迄點縣市 *</Label>
                  <Input
                    data-testid="ctcr-dest-city"
                    className="h-9 mt-1"
                    value={destinationCity}
                    onChange={(e) => setDestinationCity(e.target.value)}
                    placeholder="例：新北市"
                  />
                </div>
                {matchLevel === 1 && (
                  <div>
                    <Label className="text-xs">迄點行政區 *</Label>
                    <Input
                      data-testid="ctcr-dest-district"
                      className="h-9 mt-1"
                      value={destinationDistrict}
                      onChange={(e) => setDestinationDistrict(e.target.value)}
                      placeholder="例：板橋區"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              data-testid="ctcr-block"
              checked={blockFallthrough}
              onChange={(e) => setBlockFallthrough(e.target.checked)}
            />
            block_fallthrough（停用列阻擋同層 fallback）
          </label>

          <div className="flex gap-2">
            <Button
              data-testid="ctcr-submit"
              size="sm"
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              建立費率
            </Button>
            <Button
              data-testid="ctcr-refresh"
              size="sm"
              variant="outline"
              onClick={() => ratesQ.refetch()}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              重新載入
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">已建立費率</CardTitle>
        </CardHeader>
        <CardContent>
          {ratesQ.isLoading ? (
            <p className="text-sm text-muted-foreground">載入中…</p>
          ) : (ratesQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無費率</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="ctcr-rate-table">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5 pr-2">ID</th>
                    <th className="py-1.5 pr-2">客戶</th>
                    <th className="py-1.5 pr-2">層級</th>
                    <th className="py-1.5 pr-2">起訖</th>
                    <th className="py-1.5 pr-2">車型</th>
                    <th className="py-1.5 pr-2">服務</th>
                    <th className="py-1.5 pr-2">成本</th>
                    <th className="py-1.5 pr-2" />
                  </tr>
                </thead>
                <tbody>
                  {(ratesQ.data ?? []).map((r) => (
                    <tr key={r.id} className="border-b border-muted/40" data-testid={`ctcr-row-${r.id}`}>
                      <td className="py-1.5 pr-2 font-mono">{r.id}</td>
                      <td className="py-1.5 pr-2">{customerLabel.get(r.customerId) ?? `#${r.customerId}`}</td>
                      <td className="py-1.5 pr-2">L{r.matchLevel}</td>
                      <td className="py-1.5 pr-2">
                        {r.matchLevel === 3
                          ? "—"
                          : `${r.originCity ?? ""}${r.originDistrict ? r.originDistrict : ""} → ${r.destinationCity ?? ""}${r.destinationDistrict ? r.destinationDistrict : ""}`}
                      </td>
                      <td className="py-1.5 pr-2">{r.vehicleType}</td>
                      <td className="py-1.5 pr-2">{r.serviceType ?? "—"}</td>
                      <td className="py-1.5 pr-2 font-semibold" data-testid={`ctcr-cost-cell-${r.id}`}>
                        NT${Number(r.standardDriverTripCost).toLocaleString()}
                      </td>
                      <td className="py-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive"
                          data-testid={`ctcr-delete-${r.id}`}
                          onClick={() => {
                            if (confirm(`刪除費率 #${r.id}？`)) deleteMut.mutate(r.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
