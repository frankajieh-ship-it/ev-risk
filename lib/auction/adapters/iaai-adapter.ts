/**
 * IAAI Source Adapter — Phase 2 Stub
 *
 * Returns AuctionSourceNotSupportedError for all fetch methods.
 * Enables clean error surfacing at the API layer before the IAAI
 * provider integration is built.
 *
 * Replace this file entirely in Phase 2 with real IAAI provider logic.
 */

import {
  type AuctionSourceAdapter,
  type NormalizedAuctionLot,
  AuctionSourceNotSupportedError,
} from "../types";

async function notSupported(): Promise<NormalizedAuctionLot> {
  throw new AuctionSourceNotSupportedError("iaai");
}

export const iaaiAdapter: AuctionSourceAdapter = {
  fetchByUrl: notSupported,
  fetchByLot: notSupported,
  fetchByVin: notSupported,
};
