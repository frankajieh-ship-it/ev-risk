/**
 * Phase 0.5: PersonalizationOpportunityCard
 *
 * Purpose: Prevent "ghost user" problem by showing latent value
 * Activation: When personalizationInputs.count === 0
 * Placement: Inside report, after initial risk summary
 */

interface PersonalizationOpportunity {
  icon: string;
  text: string;
  condition: boolean;
}

interface PersonalizationOpportunityCardProps {
  vehicleData: {
    range?: number;
    age?: number;
    hasChargingInfo?: boolean;
  };
  onAddInfo: () => void;
}

export default function PersonalizationOpportunityCard({
  vehicleData,
  onAddInfo,
}: PersonalizationOpportunityCardProps) {
  // Generate dynamic opportunities based on vehicle context
  const opportunities: PersonalizationOpportunity[] = [
    {
      icon: "🚗",
      text: "Whether this range comfortably covers YOUR commute",
      condition: (vehicleData.range || 0) < 250,
    },
    {
      icon: "⚡",
      text: "How your charging access changes ownership risk",
      condition: !vehicleData.hasChargingInfo,
    },
    {
      icon: "📊",
      text: "How battery degradation affects YOUR driving pattern",
      condition: (vehicleData.age || 0) > 4,
    },
    {
      icon: "💰",
      text: "Actual ownership costs based on YOUR usage",
      condition: true, // Always relevant
    },
  ];

  // Filter opportunities to show only relevant ones
  const relevantOpportunities = opportunities.filter((opp) => opp.condition);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl shadow-lg p-8 mb-8">
      {/* Heading */}
      <div className="flex items-start mb-4">
        <div className="flex-shrink-0 mr-4">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            What we could tell you with 2 minutes of info
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            We analyzed this vehicle using listing data only.{" "}
            <span className="font-semibold">
              A few details about you would let us be much more precise.
            </span>
          </p>
        </div>
      </div>

      {/* Dynamic Opportunities */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {relevantOpportunities.map((opportunity, index) => (
          <div
            key={index}
            className="flex items-start p-4 bg-white rounded-lg border border-blue-200 shadow-sm"
          >
            <span className="text-2xl mr-3 flex-shrink-0">{opportunity.icon}</span>
            <p className="text-sm text-gray-800 font-medium">{opportunity.text}</p>
          </div>
        ))}
      </div>

      {/* CTA - Inline scroll, not navigate */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-600 italic">
          This won't change your report — it makes it more personal
        </p>
        <button
          onClick={onAddInfo}
          className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Add your info
        </button>
      </div>
    </div>
  );
}
