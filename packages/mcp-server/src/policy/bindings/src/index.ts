import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"NotInitialized"},
  2: {message:"AlreadyInitialized"},
  3: {message:"Unauthorized"},
  4: {message:"InvalidLimit"},
  5: {message:"PerCallLimitExceeded"},
  6: {message:"DailyLimitExceeded"},
  7: {message:"NegativeAmount"},
  8: {message:"NotAllowed"},
  9: {message:"HistoryCapacityExceeded"}
}


export interface Status {
  daily_remaining: i128;
  daily_spent: i128;
  history_len: u32;
  max_per_call: i128;
  max_per_day: i128;
  owner: string;
  period_ledgers: u32;
}

export type DataKey = {tag: "State", values: void};


export interface PolicyState {
  cached_daily_spent: i128;
  max_per_call: i128;
  max_per_day: i128;
  owner: string;
  period_ledgers: u32;
  spending_history: Array<SpendingEntry>;
}


export interface SpendingEntry {
  amount: i128;
  ledger_sequence: u32;
}

export interface Client {
  /**
   * Construct and simulate a get_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read current limits and rolling-window spend.
   */
  get_status: (options?: MethodOptions) => Promise<AssembledTransaction<Status>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * One-time setup after deploy. Stores owner + limits.
   * 
   * `max_per_call` and `max_per_day` are in stroops (same units as token
   * `transfer` amounts the policy inspects).
   */
  initialize: ({owner, max_per_call, max_per_day}: {owner: string, max_per_call: i128, max_per_day: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_limits transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Owner-only limit update. Does not redeploy the contract.
   */
  set_limits: ({max_per_call, max_per_day}: {max_per_call: i128, max_per_day: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a check_spend transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Isolation-test helper: enforce limits and record spend on success.
   * 
   * Requires owner authorization. Use this before the contract is attached to
   * a smart account policy signer.
   */
  check_spend: ({amount}: {amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAC1SZWFkIGN1cnJlbnQgbGltaXRzIGFuZCByb2xsaW5nLXdpbmRvdyBzcGVuZC4AAAAAAAAKZ2V0X3N0YXR1cwAAAAAAAAAAAAEAAAfQAAAABlN0YXR1cwAA",
        "AAAAAAAAAKJPbmUtdGltZSBzZXR1cCBhZnRlciBkZXBsb3kuIFN0b3JlcyBvd25lciArIGxpbWl0cy4KCmBtYXhfcGVyX2NhbGxgIGFuZCBgbWF4X3Blcl9kYXlgIGFyZSBpbiBzdHJvb3BzIChzYW1lIHVuaXRzIGFzIHRva2VuCmB0cmFuc2ZlcmAgYW1vdW50cyB0aGUgcG9saWN5IGluc3BlY3RzKS4AAAAAAAppbml0aWFsaXplAAAAAAADAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAADG1heF9wZXJfY2FsbAAAAAsAAAAAAAAAC21heF9wZXJfZGF5AAAAAAsAAAAA",
        "AAAAAAAAADhPd25lci1vbmx5IGxpbWl0IHVwZGF0ZS4gRG9lcyBub3QgcmVkZXBsb3kgdGhlIGNvbnRyYWN0LgAAAApzZXRfbGltaXRzAAAAAAACAAAAAAAAAAxtYXhfcGVyX2NhbGwAAAALAAAAAAAAAAttYXhfcGVyX2RheQAAAAALAAAAAA==",
        "AAAAAAAAAKxJc29sYXRpb24tdGVzdCBoZWxwZXI6IGVuZm9yY2UgbGltaXRzIGFuZCByZWNvcmQgc3BlbmQgb24gc3VjY2Vzcy4KClJlcXVpcmVzIG93bmVyIGF1dGhvcml6YXRpb24uIFVzZSB0aGlzIGJlZm9yZSB0aGUgY29udHJhY3QgaXMgYXR0YWNoZWQgdG8KYSBzbWFydCBhY2NvdW50IHBvbGljeSBzaWduZXIuAAAAC2NoZWNrX3NwZW5kAAAAAAEAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACQAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAAEkFscmVhZHlJbml0aWFsaXplZAAAAAAAAgAAAAAAAAAMVW5hdXRob3JpemVkAAAAAwAAAAAAAAAMSW52YWxpZExpbWl0AAAABAAAAAAAAAAUUGVyQ2FsbExpbWl0RXhjZWVkZWQAAAAFAAAAAAAAABJEYWlseUxpbWl0RXhjZWVkZWQAAAAAAAYAAAAAAAAADk5lZ2F0aXZlQW1vdW50AAAAAAAHAAAAAAAAAApOb3RBbGxvd2VkAAAAAAAIAAAAAAAAABdIaXN0b3J5Q2FwYWNpdHlFeGNlZWRlZAAAAAAJ",
        "AAAAAQAAAAAAAAAAAAAABlN0YXR1cwAAAAAABwAAAAAAAAAPZGFpbHlfcmVtYWluaW5nAAAAAAsAAAAAAAAAC2RhaWx5X3NwZW50AAAAAAsAAAAAAAAAC2hpc3RvcnlfbGVuAAAAAAQAAAAAAAAADG1heF9wZXJfY2FsbAAAAAsAAAAAAAAAC21heF9wZXJfZGF5AAAAAAsAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAOcGVyaW9kX2xlZGdlcnMAAAAAAAQ=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAQAAAAAAAAAAAAAABVN0YXRlAAAA",
        "AAAAAQAAAAAAAAAAAAAAC1BvbGljeVN0YXRlAAAAAAYAAAAAAAAAEmNhY2hlZF9kYWlseV9zcGVudAAAAAAACwAAAAAAAAAMbWF4X3Blcl9jYWxsAAAACwAAAAAAAAALbWF4X3Blcl9kYXkAAAAACwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAA5wZXJpb2RfbGVkZ2VycwAAAAAABAAAAAAAAAAQc3BlbmRpbmdfaGlzdG9yeQAAA+oAAAfQAAAADVNwZW5kaW5nRW50cnkAAAA=",
        "AAAAAQAAAAAAAAAAAAAADVNwZW5kaW5nRW50cnkAAAAAAAACAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAD2xlZGdlcl9zZXF1ZW5jZQAAAAAE" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_status: this.txFromJSON<Status>,
        initialize: this.txFromJSON<null>,
        set_limits: this.txFromJSON<null>,
        check_spend: this.txFromJSON<null>
  }
}