/**
 * Minimal NORMAL PATH writer for commercial_trip_cost_rates.
 * CREATE + LIST (+ DELETE for ops mistake / test cleanup).
 * Does NOT invent money; does NOT bypass commercialCostEngine.
 */
import { Router } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { commercialTripCostRatesTable } from "@workspace/db";

export const commercialTripCostRatesRouter = Router();

function emptyToNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function shapeFieldsForLevel(level: 1 | 2 | 3, raw: {
  originCity?: unknown;
  originDistrict?: unknown;
  destinationCity?: unknown;
  destinationDistrict?: unknown;
}): {
  originCity: string | null;
  originDistrict: string | null;
  destinationCity: string | null;
  destinationDistrict: string | null;
} | { error: string } {
  const originCity = emptyToNull(raw.originCity);
  const originDistrict = emptyToNull(raw.originDistrict);
  const destinationCity = emptyToNull(raw.destinationCity);
  const destinationDistrict = emptyToNull(raw.destinationDistrict);

  if (level === 1) {
    if (!originCity || !originDistrict || !destinationCity || !destinationDistrict) {
      return { error: "L1 需填寫起訖縣市與行政區" };
    }
    return { originCity, originDistrict, destinationCity, destinationDistrict };
  }
  if (level === 2) {
    if (!originCity || !destinationCity) {
      return { error: "L2 需填寫起訖縣市（行政區留空）" };
    }
    return {
      originCity,
      originDistrict: null,
      destinationCity,
      destinationDistrict: null,
    };
  }
  // L3: customer + vehicle default — OD must be null
  return {
    originCity: null,
    originDistrict: null,
    destinationCity: null,
    destinationDistrict: null,
  };
}

const CreateBody = z.object({
  customerId: z.coerce.number().int().positive(),
  matchLevel: z.coerce.number().int().refine((n): n is 1 | 2 | 3 => n === 1 || n === 2 || n === 3, {
    message: "matchLevel 必須為 1、2 或 3",
  }),
  originCity: z.string().nullish(),
  originDistrict: z.string().nullish(),
  destinationCity: z.string().nullish(),
  destinationDistrict: z.string().nullish(),
  vehicleType: z.string().min(1, "車型必填"),
  serviceType: z.string().nullish(),
  standardDriverTripCost: z.coerce.number().positive("標準司機趟次成本必須 > 0"),
  active: z.boolean().optional(),
  blockFallthrough: z.boolean().optional(),
  notes: z.string().nullish(),
});

/** GET /api/commercial-trip-cost-rates */
commercialTripCostRatesRouter.get("/commercial-trip-cost-rates", async (req, res) => {
  try {
    const customerIdRaw = req.query.customerId;
    const customerId =
      customerIdRaw != null && String(customerIdRaw).trim() !== ""
        ? Number(customerIdRaw)
        : null;

    const rows =
      customerId != null && Number.isFinite(customerId)
        ? await db
            .select()
            .from(commercialTripCostRatesTable)
            .where(eq(commercialTripCostRatesTable.customerId, customerId))
            .orderBy(desc(commercialTripCostRatesTable.id))
        : await db
            .select()
            .from(commercialTripCostRatesTable)
            .orderBy(desc(commercialTripCostRatesTable.id));

    res.json({ ok: true, items: rows });
  } catch (err) {
    req.log?.error?.({ err }, "list commercial trip cost rates failed");
    res.status(500).json({ ok: false, error: "Failed to list commercial trip cost rates" });
  }
});

/** POST /api/commercial-trip-cost-rates — NORMAL PATH writer */
commercialTripCostRatesRouter.post("/commercial-trip-cost-rates", async (req, res) => {
  try {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join("; "),
      });
    }
    const body = parsed.data;
    const shaped = shapeFieldsForLevel(body.matchLevel, body);
    if ("error" in shaped) {
      return res.status(400).json({ ok: false, error: shaped.error });
    }

    const vehicleType = body.vehicleType.trim();
    const serviceType = emptyToNull(body.serviceType);
    const notes = emptyToNull(body.notes);

    const [row] = await db
      .insert(commercialTripCostRatesTable)
      .values({
        customerId: body.customerId,
        matchLevel: body.matchLevel,
        originCity: shaped.originCity,
        originDistrict: shaped.originDistrict,
        destinationCity: shaped.destinationCity,
        destinationDistrict: shaped.destinationDistrict,
        vehicleType,
        serviceType,
        standardDriverTripCost: String(body.standardDriverTripCost),
        active: body.active ?? true,
        blockFallthrough: body.blockFallthrough ?? false,
        notes,
      })
      .returning();

    res.status(201).json({ ok: true, item: row });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // unique violation
    if (/unique|duplicate|ctcr_l/i.test(msg)) {
      return res.status(409).json({ ok: false, error: "相同匹配鍵的費率已存在" });
    }
    if (/foreign key|ctcr_customer_fk/i.test(msg)) {
      return res.status(400).json({ ok: false, error: "customerId 不存在" });
    }
    if (/ctcr_cost_positive|check/i.test(msg)) {
      return res.status(400).json({ ok: false, error: "費率欄位不符合 schema 約束" });
    }
    req.log?.error?.({ err }, "create commercial trip cost rate failed");
    res.status(500).json({ ok: false, error: "Failed to create commercial trip cost rate" });
  }
});

/** DELETE /api/commercial-trip-cost-rates/:id — remove mistaken rate / test cleanup */
commercialTripCostRatesRouter.delete("/commercial-trip-cost-rates/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "invalid id" });
    }
    const deleted = await db
      .delete(commercialTripCostRatesTable)
      .where(eq(commercialTripCostRatesTable.id, id))
      .returning({ id: commercialTripCostRatesTable.id });

    if (deleted.length === 0) {
      return res.status(404).json({ ok: false, error: "not found" });
    }
    res.json({ ok: true, id: deleted[0].id });
  } catch (err) {
    req.log?.error?.({ err }, "delete commercial trip cost rate failed");
    res.status(500).json({ ok: false, error: "Failed to delete commercial trip cost rate" });
  }
});
