"use client";

import { toast } from "sonner";
import { CreditCard, Download } from "lucide-react";

import { StatCardSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import * as api from "@/lib/api";
import { fmtDate, fmtInt, fmtUSD } from "@/lib/utils";
import { useLoad } from "@/hooks/use-load";
import { cn } from "@/lib/utils";

function UsageBar({ label, used, limit, format }: { label: string; used: number; limit: number; format: (v: number) => string }) {
  const fraction = Math.min(1, used / limit);
  return (
    <div>
      <div className="flex justify-between text-[13px]">
        <span>{label}</span>
        <span className="font-mono tabular text-muted-foreground">
          {format(used)} / {format(limit)}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated"
        role="meter"
        aria-valuenow={Math.round(fraction * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} usage`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            fraction >= 0.9 ? "bg-warning" : "bg-teal",
          )}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}

export function BillingSection() {
  const { data: billing } = useLoad(() => api.getBilling(), []);
  const { data: invoices } = useLoad(() => api.getInvoices(), []);

  return (
    <div className="space-y-6">
      {!billing ? (
        <StatCardSkeleton />
      ) : (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-muted-foreground">Current plan</p>
              <p className="mt-1 text-2xl font-medium">
                {billing.plan}
                <span className="ml-2 align-middle font-mono text-sm text-muted-foreground">
                  $49/mo
                </span>
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Renews {fmtDate(billing.renewsAt)}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                toast.info("Enterprise is a conversation", {
                  description: "We'd reach out — this is a preview build.",
                })
              }
            >
              Upgrade to Enterprise
            </Button>
          </div>
          <div className="mt-6 space-y-4">
            <UsageBar
              label="MCP calls"
              used={billing.mcpCallsUsed}
              limit={billing.mcpCallsLimit}
              format={fmtInt}
            />
            <UsageBar
              label="Transaction volume"
              used={billing.txVolumeUsedUSD}
              limit={billing.txVolumeLimitUSD}
              format={fmtUSD}
            />
          </div>
        </Card>
      )}

      {billing?.paymentMethod ? (
        <Card className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <CreditCard className="size-5 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-sm">
                {billing.paymentMethod.brand} ending {billing.paymentMethod.last4}
              </p>
              <p className="text-[13px] text-muted-foreground">Default payment method</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => toast.info("Payment methods are mocked in this preview")}
          >
            Update
          </Button>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <p className="text-[13px] font-medium text-muted-foreground">Invoices</p>
        </div>
        {!invoices ? (
          <TableSkeleton rows={4} cols={4} className="p-5" />
        ) : (
          <ul className="divide-y divide-border">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center gap-3 px-5 py-3">
                <span className="font-mono text-[13px]">{invoice.number}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(invoice.date)}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-auto font-normal",
                    invoice.status === "paid" ? "text-success" : "text-warning",
                  )}
                >
                  {invoice.status === "paid" ? "Paid" : "Due"}
                </Badge>
                <span className="w-16 text-right font-mono text-[13px] tabular">
                  {fmtUSD(invoice.amountUSD)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  aria-label={`Download ${invoice.number}`}
                  onClick={() => toast.success(`Downloading ${invoice.number}.pdf`)}
                >
                  <Download className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
