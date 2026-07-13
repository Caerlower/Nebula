import { evaluateConfirmation } from "../src/policy/confirmation.js";
import type { PolicySnapshot } from "../src/types/context.js";

const base: PolicySnapshot = {
  microThreshold: 0.1,
  perTxCap: 5,
  dailyCap: 20,
  paused: false,
  whitelist: ["GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"],
  denylist: ["GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"],
  dailySpentUsdc: 0,
};

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const denylist = evaluateConfirmation({
  destination: base.denylist[0]!,
  amountUsdc: 0.01,
  policy: base,
});
assert(denylist.action === "reject", "denylist must reject");

const micro = evaluateConfirmation({
  destination: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCD",
  amountUsdc: 0.05,
  policy: base,
});
assert(micro.action === "auto", "micro must auto");

const white = evaluateConfirmation({
  destination: base.whitelist[0]!,
  amountUsdc: 2,
  policy: base,
});
assert(white.action === "auto", "whitelist within per_tx must auto");

const novel = evaluateConfirmation({
  destination: "GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
  amountUsdc: 2,
  policy: base,
});
assert(novel.action === "confirm", "new dest must confirm");

const overTx = evaluateConfirmation({
  destination: base.whitelist[0]!,
  amountUsdc: 6,
  policy: base,
});
assert(overTx.action === "reject", "over per_tx must reject (on-chain cannot be bypassed)");

const overDaily = evaluateConfirmation({
  destination: base.whitelist[0]!,
  amountUsdc: 2,
  policy: { ...base, dailySpentUsdc: 19 },
});
assert(overDaily.action === "reject", "over daily must reject");

const openIgnore = evaluateConfirmation({
  destination: "GEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
  amountUsdc: 50,
  policy: base,
  ignoreSpendCaps: true,
});
assert(openIgnore.action === "confirm", "ignoreSpendCaps still confirms novel dest");

console.log("confirmation matrix tests passed");
