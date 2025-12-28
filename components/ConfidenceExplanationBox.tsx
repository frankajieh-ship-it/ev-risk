/**
 * Phase 0.5: ConfidenceExplanationBox
 *
 * Purpose: Users trust systems that admit uncertainty and explain it
 * Key: Show current confidence vs. potential confidence
 * Warning: Use ~95%, not 95.0% - avoid false precision
 */

interface ConfidenceData {
  current: number; // 0-100
  potential: number; // What it could be with personalization
  basedOn: string[]; // What we DO have
  missing: string[]; // What we DON'T have
}

interface ConfidenceExplanationBoxProps {
  confidence: ConfidenceData;
}

export default function ConfidenceExplanationBox({
  confidence,
}: ConfidenceExplanationBoxProps) {
  // Determine confidence level label
  const getConfidenceLevel = (score: number): string => {
    if (score >= 80) return "High";
    if (score >= 60) return "Medium";
    return "Low";
  };

  // Determine color scheme based on confidence
  const getColorClasses = (score: number) => {
    if (score >= 80)
      return {
        bg: "bg-green-100",
        border: "border-green-400",
        text: "text-green-900",
        icon: "text-green-600",
      };
    if (score >= 60)
      return {
        bg: "bg-yellow-100",
        border: "border-yellow-400",
        text: "text-yellow-900",
        icon: "text-yellow-600",
      };
    return {
      bg: "bg-orange-100",
      border: "border-orange-400",
      text: "text-orange-900",
      icon: "text-orange-600",
    };
  };

  const colors = getColorClasses(confidence.current);
  const confidenceLevel = getConfidenceLevel(confidence.current);

  // Calculate potential improvement
  const potentialGain = confidence.potential - confidence.current;

  return (
    <div
      className={`${colors.bg} border-2 ${colors.border} rounded-2xl shadow-lg p-6 mb-8`}
    >
      {/* Header with confidence level */}
      <div className="flex items-center mb-4">
        <div className={`flex-shrink-0 mr-4 ${colors.icon}`}>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className={`text-xl font-bold ${colors.text}`}>
            🔐 Assessment Confidence: {confidenceLevel} ({confidence.current}%)
          </h3>
        </div>
      </div>

      {/* Explanation of what we based this on */}
      <div className="mb-4">
        <p className={`text-sm font-semibold ${colors.text} mb-2`}>
          This assessment is based on:
        </p>
        <ul className={`text-sm ${colors.text} space-y-1 ml-4`}>
          {confidence.basedOn.map((item, index) => (
            <li key={index} className="flex items-start">
              <span className="mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* What we couldn't verify */}
      <div className="mb-4">
        <p className={`text-sm font-semibold ${colors.text} mb-2`}>
          We could not verify:
        </p>
        <ul className={`text-sm ${colors.text} space-y-1 ml-4`}>
          {confidence.missing.map((item, index) => (
            <li key={index} className="flex items-start">
              <span className="mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Confidence Improvement Indicator */}
      {potentialGain > 0 && (
        <div className="pt-4 border-t-2 border-current opacity-30">
          <div
            className={`bg-white border-2 ${colors.border} rounded-lg p-4 flex items-start`}
          >
            <svg
              className={`w-6 h-6 ${colors.icon} mr-3 flex-shrink-0`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
            <p className={`text-sm ${colors.text}`}>
              <span className="font-semibold">
                If we knew your driving and charging habits, confidence increases to ~
                {confidence.potential}%
              </span>
              <br />
              <span className="text-xs opacity-75">
                (This is a range indicator, not a promise)
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
