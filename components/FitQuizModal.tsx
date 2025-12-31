"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Battery, Home, Zap, Clock, DollarSign } from "lucide-react";
import { useRouter } from "next/navigation";

interface FitQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuizAnswers {
  dailyMiles: number;
  homeCharging: boolean;
  parkingType: "garage" | "driveway" | "street" | "apartment";
  urgency: "immediate" | "1-3months" | "exploring";
  budget: "under30k" | "30-50k" | "50k+";
}

const questions = [
  {
    id: "dailyMiles",
    title: "Daily driving distance",
    icon: Clock,
    description: "How many miles do you typically drive per day?",
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
    options: [
      { value: true, label: "Yes", description: "I have a garage or driveway with outlet access" },
      { value: false, label: "No", description: "I rely on public charging only" },
    ],
  },
  {
    id: "parkingType",
    title: "Parking situation",
    icon: Zap,
    description: "Where do you usually park overnight?",
    options: [
      { value: "garage", label: "Private garage", description: "Easy to install charger" },
      { value: "driveway", label: "Driveway", description: "Can install outdoor charger" },
      { value: "street", label: "Street parking", description: "Limited charging access" },
      { value: "apartment", label: "Apartment complex", description: "Depends on building amenities" },
    ],
  },
  {
    id: "urgency",
    title: "Purchase timeline",
    icon: Clock,
    description: "When are you looking to buy?",
    options: [
      { value: "immediate", label: "This week", description: "Ready to buy now" },
      { value: "1-3months", label: "1-3 months", description: "Actively shopping" },
      { value: "exploring", label: "Just exploring", description: "Learning and comparing" },
    ],
  },
  {
    id: "budget",
    title: "Budget range",
    icon: DollarSign,
    description: "What's your target price range?",
    options: [
      { value: "under30k", label: "Under $30k", description: "Budget-friendly options" },
      { value: "30-50k", label: "$30k - $50k", description: "Mid-range models" },
      { value: "50k+", label: "$50k+", description: "Premium or new vehicles" },
    ],
  },
];

export default function FitQuizModal({ isOpen, onClose }: FitQuizModalProps) {
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

    // Auto-advance to next question after brief delay
    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
      }
    }, 300);
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    // Create quiz data payload
    const quizData = {
      dailyMiles: answers.dailyMiles || 30,
      homeCharging: answers.homeCharging ?? true,
      parkingType: answers.parkingType || "garage",
      urgency: answers.urgency || "exploring",
      budget: answers.budget || "30-50k",
      source: "fit-quiz",
    };

    // Navigate to results page with quiz data
    const queryParams = new URLSearchParams({
      data: JSON.stringify(quizData),
      quiz: "true",
    });

    router.push(`/report?${queryParams.toString()}`);
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const currentQ = questions[currentQuestion];
  const Icon = currentQ.icon;
  const isLastQuestion = currentQuestion === questions.length - 1;
  const canSubmit = Object.keys(answers).length === questions.length;

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

                      {/* Options */}
                      <div className="space-y-3">
                        {currentQ.options.map((option, idx) => {
                          const isSelected = answers[currentQ.id as keyof QuizAnswers] === option.value;

                          return (
                            <motion.button
                              key={idx}
                              onClick={() => handleAnswer(currentQ.id, option.value)}
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
                    </motion.div>
                  </AnimatePresence>

                  {/* Navigation */}
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
                    <button
                      onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
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
                        {answers[currentQ.id as keyof QuizAnswers] ? "Answer selected" : "Select an answer"}
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
