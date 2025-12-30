/**
 * Sprint 2 Task 4: Charging Fit Input Form
 *
 * Simple self-reported inputs (4 questions)
 * - Primary charging type
 * - Charging reliability
 * - Backup plan within 10-15 minutes
 * - Weekly charging moments
 */

"use client";

import { useState } from "react";
import type { ChargingFitInputs } from "./ChargingFitRoutineFriction";

interface ChargingFitInputFormProps {
  onSubmit: (inputs: ChargingFitInputs) => void;
  initialValues?: Partial<ChargingFitInputs>;
}

export default function ChargingFitInputForm({
  onSubmit,
  initialValues,
}: ChargingFitInputFormProps) {
  const [inputs, setInputs] = useState<ChargingFitInputs>({
    primaryChargingType: initialValues?.primaryChargingType || "home",
    chargingReliability: initialValues?.chargingReliability || "usually_available",
    backupPlanWithin15Min: initialValues?.backupPlanWithin15Min ?? true,
    weeklyChargingMoments: initialValues?.weeklyChargingMoments || "1-2",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(inputs);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Question 1: Primary Charging Type */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          1. Primary charging type:
        </label>
        <div className="space-y-2">
          <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition">
            <input
              type="radio"
              name="primaryChargingType"
              value="home"
              checked={inputs.primaryChargingType === "home"}
              onChange={(e) =>
                setInputs({ ...inputs, primaryChargingType: e.target.value as any })
              }
              className="mt-1 mr-3"
            />
            <div>
              <span className="font-medium text-gray-900">Home</span>
              <p className="text-sm text-gray-600">
                Single-family home with dedicated charging (Level 1 or Level 2)
              </p>
            </div>
          </label>

          <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition">
            <input
              type="radio"
              name="primaryChargingType"
              value="apartment_shared"
              checked={inputs.primaryChargingType === "apartment_shared"}
              onChange={(e) =>
                setInputs({ ...inputs, primaryChargingType: e.target.value as any })
              }
              className="mt-1 mr-3"
            />
            <div>
              <span className="font-medium text-gray-900">Apartment / Shared</span>
              <p className="text-sm text-gray-600">
                Apartment, condo, or townhouse with shared/building-provided charging
              </p>
            </div>
          </label>

          <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition">
            <input
              type="radio"
              name="primaryChargingType"
              value="public_only"
              checked={inputs.primaryChargingType === "public_only"}
              onChange={(e) =>
                setInputs({ ...inputs, primaryChargingType: e.target.value as any })
              }
              className="mt-1 mr-3"
            />
            <div>
              <span className="font-medium text-gray-900">Public only</span>
              <p className="text-sm text-gray-600">
                No home or workplace charging—rely on public charging networks
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Question 2: Charging Reliability */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          2. Charging reliability:
        </label>
        <div className="space-y-2">
          <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition">
            <input
              type="radio"
              name="chargingReliability"
              value="usually_available"
              checked={inputs.chargingReliability === "usually_available"}
              onChange={(e) =>
                setInputs({ ...inputs, chargingReliability: e.target.value as any })
              }
              className="mt-1 mr-3"
            />
            <div>
              <span className="font-medium text-gray-900">Usually available</span>
              <p className="text-sm text-gray-600">
                Charging is almost always accessible when you need it
              </p>
            </div>
          </label>

          <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition">
            <input
              type="radio"
              name="chargingReliability"
              value="sometimes_available"
              checked={inputs.chargingReliability === "sometimes_available"}
              onChange={(e) =>
                setInputs({ ...inputs, chargingReliability: e.target.value as any })
              }
              className="mt-1 mr-3"
            />
            <div>
              <span className="font-medium text-gray-900">Sometimes available</span>
              <p className="text-sm text-gray-600">
                Occasionally occupied, broken, or restricted by time windows
              </p>
            </div>
          </label>

          <label className="flex items-start p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition">
            <input
              type="radio"
              name="chargingReliability"
              value="unpredictable"
              checked={inputs.chargingReliability === "unpredictable"}
              onChange={(e) =>
                setInputs({ ...inputs, chargingReliability: e.target.value as any })
              }
              className="mt-1 mr-3"
            />
            <div>
              <span className="font-medium text-gray-900">Unpredictable</span>
              <p className="text-sm text-gray-600">
                Often broken, occupied, or have uncertain access
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Question 3: Backup Plan */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          3. Backup plan within 10–15 minutes:
        </label>
        <div className="space-y-2">
          <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition">
            <input
              type="radio"
              name="backupPlanWithin15Min"
              value="true"
              checked={inputs.backupPlanWithin15Min === true}
              onChange={() => setInputs({ ...inputs, backupPlanWithin15Min: true })}
              className="mr-3"
            />
            <span className="font-medium text-gray-900">
              Yes – I have reliable backup charging nearby
            </span>
          </label>

          <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition">
            <input
              type="radio"
              name="backupPlanWithin15Min"
              value="false"
              checked={inputs.backupPlanWithin15Min === false}
              onChange={() => setInputs({ ...inputs, backupPlanWithin15Min: false })}
              className="mr-3"
            />
            <span className="font-medium text-gray-900">
              No – backup options are further away or uncertain
            </span>
          </label>
        </div>
      </div>

      {/* Question 4: Weekly Charging Moments */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          4. Weekly charging moments:
        </label>
        <p className="text-sm text-gray-600 mb-3">
          How many separate charging sessions do you expect per week? (Sprint 2 Task 5:
          Weekly Energy Framing)
        </p>
        <div className="space-y-2">
          <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition">
            <input
              type="radio"
              name="weeklyChargingMoments"
              value="1-2"
              checked={inputs.weeklyChargingMoments === "1-2"}
              onChange={(e) =>
                setInputs({ ...inputs, weeklyChargingMoments: e.target.value as any })
              }
              className="mr-3"
            />
            <span className="font-medium text-gray-900">1–2 charging moments</span>
          </label>

          <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition">
            <input
              type="radio"
              name="weeklyChargingMoments"
              value="3-4"
              checked={inputs.weeklyChargingMoments === "3-4"}
              onChange={(e) =>
                setInputs({ ...inputs, weeklyChargingMoments: e.target.value as any })
              }
              className="mr-3"
            />
            <span className="font-medium text-gray-900">3–4 charging moments</span>
          </label>

          <label className="flex items-center p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition">
            <input
              type="radio"
              name="weeklyChargingMoments"
              value="5+"
              checked={inputs.weeklyChargingMoments === "5+"}
              onChange={(e) =>
                setInputs({ ...inputs, weeklyChargingMoments: e.target.value as any })
              }
              className="mr-3"
            />
            <span className="font-medium text-gray-900">5+ charging moments</span>
          </label>
        </div>
      </div>

      {/* Submit */}
      <div className="pt-4">
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors duration-200"
        >
          See Charging Fit Analysis
        </button>
      </div>
    </form>
  );
}
