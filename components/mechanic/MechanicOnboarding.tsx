"use client";

import { useState } from "react";
import {
  ChevronRight, ChevronLeft, CheckCircle, Loader2,
  MapPin, Phone, Globe, Wrench, Shield,
} from "lucide-react";
import type { ServiceType } from "@/types/mechanic";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_ICONS } from "@/types/mechanic";

interface OnboardingData {
  business_name: string;
  bio: string;
  phone: string;
  website: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  service_radius_miles: number;
  specialties: ServiceType[];
  certifications: string[];
}

interface MechanicOnboardingProps {
  onSubmit: (data: OnboardingData) => Promise<{ success: boolean; slug?: string; error?: string }>;
}

type Step = "business" | "location" | "services" | "done";
const STEPS: Step[] = ["business", "location", "services"];

const CERT_OPTIONS = ["ASE Certified", "I-CAR", "EV Certified", "Hybrid Specialist", "Factory Trained"];
const RADIUS_OPTIONS = [10, 25, 50, 100, 150];
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

export default function MechanicOnboarding({ onSubmit }: MechanicOnboardingProps) {
  const [step, setStep] = useState<Step>("business");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resultSlug, setResultSlug] = useState("");

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState(50);
  const [specialties, setSpecialties] = useState<ServiceType[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);

  const currentIndex = STEPS.indexOf(step);

  const canAdvanceBusiness = businessName.trim().length >= 2;
  const canAdvanceLocation = !!city && !!state && /^\d{5}$/.test(zip);
  const canSubmit = specialties.length > 0;

  const toggleSpecialty = (s: ServiceType) =>
    setSpecialties((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const toggleCert = (c: string) =>
    setCertifications((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const goNext = () => {
    const next = STEPS[currentIndex + 1];
    if (next) setStep(next);
  };
  const goBack = () => {
    const prev = STEPS[currentIndex - 1];
    if (prev) setStep(prev);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const result = await onSubmit({
        business_name: businessName.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        website: website.trim(),
        address_line1: address.trim(),
        city: city.trim(),
        state,
        zip,
        service_radius_miles: radius,
        specialties,
        certifications,
      });
      if (result.success) {
        setResultSlug(result.slug ?? "");
        setStep("done");
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Done state ──────────────────────────────────────────────────────── */
  if (step === "done") {
    return (
      <div className="text-center py-10 px-4 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re listed!</h2>
        <p className="text-sm text-gray-500 mb-6">
          Your profile is live. Nearby buyers and Copart dealers can now find and contact you.
          We&apos;ll email you when your first service request arrives.
        </p>
        {resultSlug && (
          <a
            href={`/mechanics/${resultSlug}`}
            className="btn-lg btn-primary w-full flex items-center justify-center gap-2"
          >
            View your profile
            <ChevronRight className="w-4 h-4" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={`h-1.5 flex-1 rounded-full transition-colors ${i <= currentIndex ? "bg-orange-500" : "bg-gray-200"}`} />
          </div>
        ))}
      </div>

      {/* ── Step 1: Business info ─────────────────────────────────────────── */}
      {step === "business" && (
        <div className="space-y-4">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-gray-900">Your business</h2>
            <p className="text-sm text-gray-500 mt-0.5">This is how buyers and dealers will find you.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Business name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Precision EV Repair"
              className="form-input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Bio / description
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Tell buyers what makes your shop different — EV experience, salvage specialization, turnaround time, etc."
              className="form-input resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{bio.length}/500</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                <Phone className="inline w-3 h-3 mr-0.5" />
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="form-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                <Globe className="inline w-3 h-3 mr-0.5" />
                Website
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourshop.com"
                className="form-input"
              />
            </div>
          </div>

          <button
            onClick={goNext}
            disabled={!canAdvanceBusiness}
            className="btn-lg btn-primary w-full flex items-center justify-center gap-2 mt-4"
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Step 2: Location ─────────────────────────────────────────────── */}
      {step === "location" && (
        <div className="space-y-4">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-gray-900">Where are you located?</h2>
            <p className="text-sm text-gray-500 mt-0.5">Used to match you with nearby buyers and dealers.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              <MapPin className="inline w-3 h-3 mr-0.5" />
              Street address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
              className="form-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Los Angeles"
                className="form-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">State <span className="text-red-400">*</span></label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="form-input bg-white"
              >
                <option value="">Select</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ZIP <span className="text-red-400">*</span></label>
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Service radius</label>
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="form-input bg-white"
              >
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r} miles</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={goBack} className="btn-md btn-ghost flex items-center gap-1.5">
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={goNext}
              disabled={!canAdvanceLocation}
              className="flex-1 btn-md btn-primary flex items-center justify-center gap-2"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Services & certifications ───────────────────────────── */}
      {step === "services" && (
        <div className="space-y-5">
          <div className="mb-2">
            <h2 className="text-lg font-bold text-gray-900">Services & credentials</h2>
            <p className="text-sm text-gray-500 mt-0.5">Select everything you offer — buyers filter by these.</p>
          </div>

          {/* Specialties */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              <Wrench className="inline w-3.5 h-3.5 mr-1" />
              Services offered <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]).map(([value, label]) => {
                const selected = specialties.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleSpecialty(value)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      selected
                        ? "border-orange-500 bg-orange-50 text-orange-900"
                        : "border-gray-200 bg-white hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <span className="text-base leading-none">{SERVICE_TYPE_ICONS[value]}</span>
                    <span className="text-sm font-medium flex-1">{label}</span>
                    {selected && <CheckCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Certifications */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              <Shield className="inline w-3.5 h-3.5 mr-1" />
              Certifications <span className="text-gray-400">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CERT_OPTIONS.map((c) => {
                const selected = certifications.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCert(c)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                      selected
                        ? "border-green-500 bg-green-50 text-green-800"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {selected && <CheckCircle className="w-3.5 h-3.5" />}
                    {c}
                  </button>
                );
              })}
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
              className="flex-1 btn-md btn-auction flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {submitting ? "Creating profile…" : "Create my listing"}
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Free to list. No subscription required.
          </p>
        </div>
      )}
    </div>
  );
}
