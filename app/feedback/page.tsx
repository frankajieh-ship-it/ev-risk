"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useEventTracking } from "@/hooks/useEventTracking";

export default function FeedbackPage() {
  const { trackEvent } = useEventTracking();
  useEffect(() => { trackEvent("feedback_page_viewed", {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [formData, setFormData] = useState({
    email: "",
    feedbackType: "general",
    helpful: "",
    missing: "",
    additionalData: "",
    comments: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to submit feedback");
      }

      console.log("Feedback submitted successfully:", result.feedbackId);
      setSubmitted(true);
    } catch (error) {
      console.error("Feedback submission error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to submit feedback. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Thank You for Your Feedback! 🙏
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              Your insights help us make EV-Risk™ more accurate and useful for
              everyone.
            </p>
            <p className="text-gray-500 mb-8">
              We review all feedback carefully and use it to continuously
              improve our analysis and recommendations.
            </p>
          </div>

          <div className="space-y-4">
            <Link
              href="/"
              className="block w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 transition-all font-semibold"
            >
              Return to EV-Risk™ Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block mb-6 hover:opacity-80 transition-opacity">
            <Image src="/offo-logo.png" alt="OFFO" width={120} height={48} className="h-12 w-auto" />
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📣 Help Us Improve
          </h1>
          <p className="text-lg text-gray-600">
            Your feedback helps us make EV-Risk™ more accurate and useful for
            everyone
          </p>
        </div>

        {/* Feedback Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email (Optional) */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email (optional - if you&apos;d like a response)
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your.email@example.com"
              />
            </div>

            {/* Feedback Type */}
            <div>
              <label
                htmlFor="feedbackType"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Type of Feedback
              </label>
              <select
                id="feedbackType"
                name="feedbackType"
                value={formData.feedbackType}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="general">General Feedback</option>
                <option value="bug">Bug Report</option>
                <option value="feature">Feature Request</option>
                <option value="accuracy">Data Accuracy Issue</option>
                <option value="ux">User Experience</option>
              </select>
            </div>

            {/* Was this report helpful? */}
            <div>
              <label
                htmlFor="helpful"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Was this report helpful in your decision-making process?
              </label>
              <textarea
                id="helpful"
                name="helpful"
                value={formData.helpful}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Tell us how the report helped (or didn't help) you..."
              />
            </div>

            {/* Missing or inaccurate information */}
            <div>
              <label
                htmlFor="missing"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Did you find any information missing or inaccurate?
              </label>
              <textarea
                id="missing"
                name="missing"
                value={formData.missing}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe what was missing or incorrect..."
              />
            </div>

            {/* Additional data points */}
            <div>
              <label
                htmlFor="additionalData"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                What additional data points would have been valuable?
              </label>
              <textarea
                id="additionalData"
                name="additionalData"
                value={formData.additionalData}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="What other information would you like to see in the analysis?"
              />
            </div>

            {/* Additional Comments */}
            <div>
              <label
                htmlFor="comments"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Any other comments or suggestions?
              </label>
              <textarea
                id="comments"
                name="comments"
                value={formData.comments}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Share any additional thoughts..."
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 transition-all font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </form>

          {/* Privacy Note */}
          <p className="text-sm text-gray-500 mt-6 text-center">
            We respect your privacy. Your feedback will only be used to improve
            EV-Risk™ and will not be shared with third parties.
          </p>
        </div>

        {/* Back Link */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to EV-Risk™ Home
          </Link>
        </div>
      </div>
    </div>
  );
}
