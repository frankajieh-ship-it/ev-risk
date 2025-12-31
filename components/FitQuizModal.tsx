"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Battery, Home, Zap, Clock, DollarSign } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEventTracking } from "@/hooks/useEventTracking";

interface FitQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Partial<QuizAnswers> & {
    batteryInfoAvailable?: boolean;
    dataSource?: 'url-extraction' | 'manual-entry';
    missingFields?: string[];
  };
}

interface QuizAnswers {
  model: string;
  year: number;
  currentMileage: number;
  zipCode: string;
  dailyMiles: number;
  homeCharging: boolean;
  riskTolerance: "conservative" | "moderate" | "aggressive";
}

const currentYear = new Date().getFullYear();

const questions = [
  {
    id: "model",
    title: "Which EV are you considering?",
    icon: Battery,
    description: "Enter the vehicle model",
    type: "text" as const,
    placeholder: "e.g., Tesla Model 3, Chevy Bolt, Nissan Leaf",
  },
  {
    id: "year",
    title: "What year?",
    icon: Clock,
    description: "Select the model year",
    type: "options" as const,
    options: Array.from({ length: 12 }, (_, i) => {
      const year = currentYear - i;
      const ageLabel = i === 0 ? "(0 yrs)" : i === 1 ? "(1 yr)" : `(${i} yrs)`;
      return {
        value: year,
        label: year.toString(),
        description: ageLabel
      };
    }),
  },
  {
    id: "currentMileage",
    title: "Current mileage?",
    icon: DollarSign,
    description: "Approximate mileage on the vehicle",
    type: "options" as const,
    options: [
      { value: 5000, label: "Under 10k miles", description: "" },
      { value: 20000, label: "10k - 30k miles", description: "" },
      { value: 45000, label: "30k - 60k miles", description: "" },
      { value: 75000, label: "60k - 90k miles", description: "" },
      { value: 100000, label: "90k+ miles", description: "" },
    ],
  },
  {
    id: "riskTolerance",
    title: "Risk comfort level",
    icon: DollarSign,
    description: "How do you approach vehicle ownership decisions?",
    type: "options" as const,
    options: [
      { value: "conservative", label: "Conservative", description: "Prefer newer, proven, low-risk options" },
      { value: "moderate", label: "Moderate", description: "Balance risk and value" },
      { value: "aggressive", label: "Adventurous", description: "Willing to take on higher risk for better deals" },
    ],
  },
  {
    id: "zipCode",
    title: "Your ZIP code?",
    icon: Home,
    description: "Where will you charge and drive this EV?",
    type: "text" as const,
    placeholder: "e.g., 94102",
    pattern: "\\d{5}",
    helperText: "Used to factor in climate + charging reliability patterns.",
  },
  {
    id: "dailyMiles",
    title: "Daily driving distance",
    icon: Zap,
    description: "How many miles do you typically drive per day?",
    type: "options" as const,
    options: [
      { value: 20, label: "Under 30 miles", description: "Short commute or mostly local" },
      { value: 50, label: "30-70 miles", description: "Medium commute" },
      { value: 100, label: "70+ miles", description: "Long commute or frequent trips" },
    ],
  },
  {
    id: "homeCharging",
    title: "Home charging access",
    icon: Home,
    description: "Can you charge at home?",
    type: "options" as const,
    options: [
      { value: true, label: "Yes", description: "I have a garage or driveway with outlet access" },
      { value: false, label: "No", description: "Charging depends on shared/public chargers" },
    ],
  },
];

export default function FitQuizModal({ isOpen, onClose, initialData }: FitQuizModalProps) {
  const router = useRouter();
  const { trackEvent } = useEventTracking();
  const [textInput, setTextInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});

  // Initialize answers with initialData when modal opens
  useEffect(() => {
    if (isOpen && initialData) {
      setAnswers(initialData);
    }
  }, [isOpen, initialData]);

  // Find first unanswered question (skip auto-filled questions)
  const findFirstUnansweredQuestion = () => {
    const currentAnswers = initialData || {};
    for (let i = 0; i < questions.length; i++) {
      const questionId = questions[i].id as keyof QuizAnswers;
      if (!currentAnswers[questionId]) {
        return i;
      }
    }
    return 0; // Default to first question if all are answered
  };

  // Jump to first unanswered question when modal opens with initial data
  useEffect(() => {
    if (isOpen && initialData) {
      console.log('[FitQuizModal] Initial data received:', initialData);
      const firstUnanswered = findFirstUnansweredQuestion();
      console.log('[FitQuizModal] Jumping to question index:', firstUnanswered, 'Question:', questions[firstUnanswered]?.id);
      setCurrentQuestion(firstUnanswered);
    }
  }, [isOpen, initialData]);

  const currentQ = questions[currentQuestion];
  const Icon = currentQ.icon;
  const isTextQuestion = currentQ.type === "text";

  const handleOptionAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

    // Auto-advance to next question after brief delay
    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
        setTextInput(""); // Reset text input for next question
      }
    }, 300);
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;

    // Validate ZIP code
    if (currentQ.id === "zipCode" && !/^\d{5}$/.test(textInput)) {
      alert("Please enter a valid 5-digit ZIP code");
      return;
    }

    setAnswers((prev) => ({ ...prev, [currentQ.id]: textInput.trim() }));

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setTextInput("");
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    // Validate all required fields
    if (!answers.model || !answers.year || !answers.currentMileage || !answers.zipCode ||
        typeof answers.dailyMiles === 'undefined' || typeof answers.homeCharging === 'undefined' ||
        !answers.riskTolerance) {
      alert("Please answer all questions");
      setSubmitting(false);
      return;
    }

    // Track report generation with source
    trackEvent("report_generated", {
      source: initialData?.dataSource || 'url_extraction',
      has_battery_info: initialData?.batteryInfoAvailable !== undefined ? initialData.batteryInfoAvailable : true,
      missing_fields_count: initialData?.missingFields?.length || 0,
    });

    // Create properly formatted data for the scoring API
    const reportData = {
      model: answers.model,
      year: answers.year,
      currentMileage: answers.currentMileage,
      zipCode: answers.zipCode,
      dailyMiles: answers.dailyMiles,
      homeCharging: answers.homeCharging,
      riskTolerance: answers.riskTolerance,
      source: "fit-quiz",
      // Pass through manual entry metadata if available
      ...(initialData?.batteryInfoAvailable !== undefined && { batteryInfoAvailable: initialData.batteryInfoAvailable }),
      ...(initialData?.dataSource && { dataSource: initialData.dataSource }),
      ...(initialData?.missingFields && initialData.missingFields.length > 0 && { missingFields: initialData.missingFields }),
    };

    console.log('[Fit Quiz] Submitting data:', reportData);

    // Navigate to results page
    const queryParams = new URLSearchParams({
      data: JSON.stringify(reportData),
    });

    router.push(`/report?${queryParams.toString()}`);
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestion === questions.length - 1;
  const currentAnswer = answers[currentQ.id as keyof QuizAnswers];
  const canProceed = isTextQuestion ? textInput.trim().length > 0 : !!currentAnswer;
  const canSubmit = Object.keys(answers).length === questions.length;

  // Debug logging
  if (isLastQuestion) {
    console.log('[FitQuizModal] On last question. Answers:', answers);
    console.log('[FitQuizModal] Answer count:', Object.keys(answers).length, 'Required:', questions.length);
    console.log('[FitQuizModal] canSubmit:', canSubmit);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>

                {/* Progress bar */}
                <div className="h-2 bg-gray-100">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-600 to-green-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {/* Content */}
                <div className="p-8">
                  {/* Question counter */}
                  <div className="text-sm font-medium text-gray-500 mb-4">
                    Question {currentQuestion + 1} of {questions.length}
                  </div>

                  {/* Question */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentQuestion}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* Icon and title */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-3 bg-gradient-to-br from-blue-50 to-green-50 rounded-xl">
                          <Icon className="w-6 h-6 text-blue-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">
                          {currentQ.title}
                        </h3>
                      </div>

                      {/* Description */}
                      <p className="text-gray-600 mb-6">{currentQ.description}</p>

                      {/* Input Type */}
                      {isTextQuestion ? (
                        <div className="space-y-4">
                          <div>
                            <input
                              type="text"
                              value={textInput || (currentAnswer as string) || ""}
                              onChange={(e) => setTextInput(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && canProceed) {
                                  handleTextSubmit();
                                }
                              }}
                              placeholder={currentQ.placeholder}
                              pattern={currentQ.pattern}
                              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-lg"
                              autoFocus
                            />
                            {(currentQ as any).helperText && (
                              <p className="text-sm text-gray-600 mt-2">
                                {(currentQ as any).helperText}
                              </p>
                            )}
                            {currentAnswer && !textInput && (
                              <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Auto-filled from listing
                              </p>
                            )}
                          </div>
                          <button
                            onClick={handleTextSubmit}
                            disabled={!canProceed}
                            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Continue
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {currentAnswer && initialData && initialData[currentQ.id as keyof QuizAnswers] && (
                            <p className="text-sm text-green-600 mb-3 flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Auto-filled from listing
                            </p>
                          )}
                          {currentQ.options?.map((option, idx) => {
                            const isSelected = currentAnswer === option.value;

                            return (
                              <motion.button
                                key={idx}
                                onClick={() => handleOptionAnswer(currentQ.id, option.value)}
                                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                                  isSelected
                                    ? "border-blue-500 bg-blue-50 shadow-md"
                                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                }`}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900 mb-1">
                                      {option.label}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {option.description}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div className="ml-3 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Navigation */}
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setCurrentQuestion(Math.max(0, currentQuestion - 1));
                        setTextInput("");
                      }}
                      disabled={currentQuestion === 0}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>

                    {isLastQuestion && canSubmit ? (
                      <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        {submitting ? "Loading..." : "See My Fit Report"}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="text-sm text-gray-500">
                        {currentAnswer || (isTextQuestion && textInput) ? "Answer provided" : "Select an answer"}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
