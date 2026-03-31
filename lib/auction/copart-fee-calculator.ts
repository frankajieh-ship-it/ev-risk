/**
 * Copart Fee Calculator
 *
 * Computes real Copart buyer fees using the published tiered schedule,
 * plus fixed fees (gate, internet, title, transport).
 */

export interface CopartFeeBreakdown {
  buyer_fee: number
  gate_fee: number
  internet_fee: number
  title_fee: number
  transport_estimate: number
  total: number
}

/**
 * Tiered buyer fee based on hammer price.
 * Source: Copart published buyer fee schedule.
 */
function computeBuyerFee(bidPrice: number): number {
  if (bidPrice < 100)    return 25
  if (bidPrice < 500)    return 50
  if (bidPrice < 1000)   return 75
  if (bidPrice < 1500)   return 100
  if (bidPrice < 2000)   return 125
  if (bidPrice < 4000)   return 200
  if (bidPrice < 6000)   return 225
  if (bidPrice < 8000)   return 275
  if (bidPrice < 12000)  return Math.round(bidPrice * 0.05)
  if (bidPrice < 15000)  return Math.round(bidPrice * 0.06)
  return Math.round(bidPrice * 0.07)
}

const GATE_FEE = 79
const INTERNET_FEE = 99
const TITLE_FEE = 65
const TRANSPORT_ESTIMATE = 250

/**
 * Compute all Copart fees for a given bid price.
 *
 * @param bidPrice - Hammer/bid price in dollars
 * @param includeTransport - Whether to include transport estimate (default: true)
 */
export function computeCopartFees(
  bidPrice: number,
  includeTransport = true
): CopartFeeBreakdown {
  const buyer_fee = computeBuyerFee(bidPrice)
  const gate_fee = GATE_FEE
  const internet_fee = INTERNET_FEE
  const title_fee = TITLE_FEE
  const transport_estimate = includeTransport ? TRANSPORT_ESTIMATE : 0

  return {
    buyer_fee,
    gate_fee,
    internet_fee,
    title_fee,
    transport_estimate,
    total: buyer_fee + gate_fee + internet_fee + title_fee + transport_estimate,
  }
}
