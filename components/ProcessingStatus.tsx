/**
 * Processing Status Component
 *
 * Shows progress during URL extraction and report generation
 */

interface ProcessingStatusProps {
  status: 'extracting' | 'analyzing' | 'identifying' | 'assessing' | 'generating' | 'complete';
  progress: number; // 0-100
}

const STATUS_MESSAGES = {
  extracting: 'Extracting vehicle details from listing...',
  analyzing: 'Reviewing listing claims and data quality...',
  identifying: 'Identifying missing risk-critical information...',
  assessing: 'Assessing battery health factors...',
  generating: 'Generating your risk report...',
  complete: 'Analysis complete!',
};

export default function ProcessingStatus({ status, progress }: ProcessingStatusProps) {
  return (
    <div className="processing-status w-full max-w-md mx-auto">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">{STATUS_MESSAGES[status]}</p>
        <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-600 to-green-600 h-2.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {status === 'complete' && (
        <div className="mt-3 flex items-center justify-center text-green-600">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-semibold">Ready!</span>
        </div>
      )}
    </div>
  );
}
