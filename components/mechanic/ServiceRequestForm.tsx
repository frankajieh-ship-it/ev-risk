"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft, Loader2, CheckCircle, Car, Wrench, CalendarDays, MapPin } from "lucide-react";
import type { ServiceType } from "@/types/mechanic";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_ICONS } from "@/types/mechanic";

interface VehicleContext {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  auction_result_id?: string;
}

interface ServiceRequestFormProps {
  vehicle?: VehicleContext;
  defaultServiceType?: ServiceType;
  defaultZip?: string;
  onSubmit: (data: {
    service_type: ServiceType;
    description: string;
    preferred_date?: string;
    zip: string;
    vehicle: VehicleContext;
  }) => Promise<{ success: boolean; request_id?: string; error?: string }>;
  onClose?: () => void;
}

type Step = "service" | "vehicle" | "details" | "submitted";

const STEP_ORDER: Step[] = ["service", "vehicle", "details"];

export default function ServiceRequestForm({
  vehicle,
  defaultServiceType,
  defaultZip = "",
  onSubmit,
  onClose,
}: ServiceRequestFormProps) {
  const [step, setStep] = useState<Step>(defaultServiceType ? "vehicle" : "service");
  const [serviceType, setServiceType] = useState<ServiceType | "">(defaultServiceType ?? "");
  const [vin, setVin] = useState(vehicle?.vin ?? "");
  const [year, setYear] = useState(vehicle?.year ? String(vehicle.year) : "");
  const [make, setMake] = useState(vehicle?.make ?? "");
  const [model, setModel] = useState(vehicle?.model ?? "");
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [zip, setZip] = useState(defaultZip);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");

  const vehicleLabel = [year, make, model].filter(Boolean).join(" ") || vehicle?.vin || "Vehicle";
  const isVehicleLocked = !!(vehicle?.make && vehicle?.model);

  const canAdvanceService = serviceType !== "";
  const canAdvanceVehicle = (!!make && !!model) || !!vin;
  const canSubmit = description.trim().length >= 20 && /^\d{5}$/.test(zip);

  const currentIndex = STEP_ORDER.indexOf(step);

  const goNext = () => {
    const next = STEP_ORDER[currentIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = STEP_ORDER[currentIndex - 1];
    if (prev) setStep(prev);
  };

  const handleSubmit = async () => {
    if (!serviceType || !canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await onSubmit({
        service_type: serviceType,
        description: description.trim(),
        preferred_date: preferredDate || undefined,
        zip,
        vehicle: { vin: vin || undefined, year: year ? Number(year) : undefined, make: make || undefined, model: model || undefined, auction_result_id: vehicle?.auction_result_id },
      });
      if (result.success) {
        setRequestId(result.request_id ?? "");
        setStep("submitted");
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Submitted state ─────────────────────────────────────────────────── */
  if (step === "submitted") {
    return (
      <div className="text-center py-8 px-4">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Request sent!</h3>
        <p className="text-sm text-gray-500 mb-1">
          Mechanics near you will review your request and send quotes within 24 hours.
        </p>
        {requestId && (
          <p className="text-xs text-gray-400 mb-6">Request ID: {requestId}</p>
        )}
        <p className="text-xs text-gray-400 mb-6">
          We&apos;ll email you when a quote arrives. Check your inbox.
        </p>
        {onClose && (
          <button onClick={onClose} className="btn-md btn-ghost w-full">
            Done
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={`h-1 flex-1 rounded-full transition-colors ${i <= currentIndex ? "bg-blue-600" : "bg-gray-200"}`} />
          </div>
        ))}
      </div>

      {/* ── Step 1: Service type ─────────────────────────────────────────── */}
      {step === "service" && (
        <div className="space-y-3">
          <div className="mb-4">
            <h3 className="text-base font-bold text-gray-900">What service do you need?</h3>
            <p className="text-sm text-gray-500 mt-0.5">Select the type of work you&apos;re looking for.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setServiceType(value)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  serviceType === value
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-200 bg-white hover:border-gray-300 text-gray-700"
                }`}
              >
                <span className="text-xl leading-none">{SERVICE_TYPE_ICONS[value]}</span>
                <span className="text-sm font-medium">{label}</span>
                {serviceType === value && (
                  <CheckCircle className="w-4 h-4 text-blue-600 ml-auto flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
          <button
            onClick={goNext}
            disabled={!canAdvanceService}
            className="btn-lg btn-primary w-full flex items-center justify-center gap-2 mt-4"
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 2: Vehicle ──────────────────────────────────────────────── */}
      {step === "vehicle" && (
        <div className="space-y-4">
          <div className="mb-2">
            <h3 className="text-base font-bold text-gray-900">
              {isVehicleLocked ? "Confirm your vehicle" : "Tell us about the vehicle"}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {isVehicleLocked
                ? "This is pre-filled from the current auction lot."
                : "Enter the vehicle details for this service request."}
            </p>
          </div>

          {isVehicleLocked ? (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <Car className="w-5 h-5 text-orange-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900">{vehicleLabel}</p>
                {vin && <p className="text-xs text-gray-500">VIN: {vin}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={year}
                    onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="2019"
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Make</label>
                  <input
                    type="text"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="Tesla"
                    className="form-input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Model 3"
                  className="form-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">VIN (optional)</label>
                <input
                  type="text"
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  placeholder="1HGCM82633A123456"
                  maxLength={17}
                  className="form-input font-mono text-xs tracking-wider"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {!defaultServiceType && (
              <button onClick={goBack} className="btn-md btn-ghost flex items-center gap-1.5">
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={goNext}
              disabled={!canAdvanceVehicle}
              className="flex-1 btn-md btn-primary flex items-center justify-center gap-2"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Details ──────────────────────────────────────────────── */}
      {step === "details" && (
        <div className="space-y-4">
          <div className="mb-2">
            <h3 className="text-base font-bold text-gray-900">Details & location</h3>
            <p className="text-sm text-gray-500 mt-0.5">Help mechanics understand what you need.</p>
          </div>

          {/* Service summary pill */}
          <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5">
            <Wrench className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{serviceType ? SERVICE_TYPE_LABELS[serviceType] : ""}</span>
            <span className="text-orange-400">·</span>
            <span className="text-orange-600 truncate">{vehicleLabel}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Describe what you need <span className="text-gray-400">(min 20 chars)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="e.g. Pre-purchase inspection on a Copart lot. Front-end collision damage. Need assessment of structural damage and estimated repair cost before bidding."
              className="form-input resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {description.length}/1000
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                <MapPin className="inline w-3 h-3 mr-0.5" />
                Your ZIP code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="90210"
                className="form-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                <CalendarDays className="inline w-3 h-3 mr-0.5" />
                Preferred date <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="date"
                value={preferredDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={goBack} className="btn-md btn-ghost flex items-center gap-1.5">
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="flex-1 btn-md btn-primary flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {submitting ? "Sending…" : "Send request"}
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Matching mechanics will receive your request and send quotes within 24 hours.
          </p>
        </div>
      )}
    </div>
  );
}
