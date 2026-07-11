import { getNetworkConfig } from "../config.js";

export function getX402Network(): "stellar:testnet" | "stellar:pubnet" {
  const network = getNetworkConfig();
  return network.name === "mainnet" ? "stellar:pubnet" : "stellar:testnet";
}
