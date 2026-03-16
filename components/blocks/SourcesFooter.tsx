/**
 * Sources Footer
 *
 * Reusable attribution footer listing data sources used in EV scoring.
 * Shown at the bottom of EVFit results and receipt pages for trust/transparency.
 */

export function SourcesFooter() {
  return (
    <div className="mt-8 pt-4 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-500 mb-1.5">Data sources</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>EPA fuel economy database</span>
        <span>NREL EV charging station locator</span>
        <span>AAA EV range &amp; temperature studies</span>
        <span>OpenWeatherMap live weather</span>
        <span>NHTSA recall database</span>
      </div>
    </div>
  );
}
