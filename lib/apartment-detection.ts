/**
 * Apartment Density Detection (Phase 0.5)
 *
 * Purpose: Detect apartment-dense areas to provide contextual charging guidance
 * WITHOUT collecting additional data or creating new forms.
 *
 * This is interpretive language injection only - not data collection.
 */

/**
 * Detects if a ZIP code is likely in an apartment-dense area
 *
 * Phase 0.5: Simple heuristic based on major metro areas
 * Future: Replace with actual Census/housing density data
 */
export function isApartmentDenseZip(zipCode?: string): boolean {
  if (!zipCode) return false;

  const zip = zipCode.trim();

  // Major metro apartment-dense ZIP prefixes (Phase 0.5 simple heuristic)
  // NYC: 100xx-104xx
  // San Francisco: 941xx
  // Los Angeles: 900xx-902xx
  // Chicago: 606xx
  // Seattle: 981xx
  // Boston: 021xx
  // DC: 200xx
  // Denver: 802xx
  // Miami: 331xx
  // Portland: 972xx

  const apartmentDensePrefixes = [
    '100', '101', '102', '103', '104', // NYC
    '941',                              // SF
    '900', '901', '902',                // LA
    '606',                              // Chicago
    '981',                              // Seattle
    '021',                              // Boston
    '200',                              // DC
    '802',                              // Denver
    '331',                              // Miami
    '972',                              // Portland
  ];

  return apartmentDensePrefixes.some(prefix => zip.startsWith(prefix));
}

/**
 * Check if user context indicates apartment EV ownership pattern
 *
 * Triggers when:
 * - ZIP is apartment-dense area
 * - User indicated no home charging
 */
export function shouldShowApartmentChargingContext(
  zipCode?: string,
  homeCharging?: boolean
): boolean {
  return isApartmentDenseZip(zipCode) && homeCharging === false;
}
