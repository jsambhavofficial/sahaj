"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { defaultApiClient } from "@/services/apiClient";
import {
  SeniorCheckInSubmissionRequest,
  SeniorCheckInSubmissionResponse,
} from "@/types/api";
import {
  Heart,
  Smile,
  Meh,
  Frown,
  AlertOctagon,
  CheckCircle2,
  PhoneCall,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";

export default function SeniorCheckInPage() {
  const router = useRouter();

  // Wizard state: 1 to 5
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<SeniorCheckInSubmissionResponse | null>(null);

  // Form State
  const [generalWellbeing, setGeneralWellbeing] = useState<string>("FEELING_WELL");
  const [concernCategories, setConcernCategories] = useState<string[]>([]);
  const [changeFromUsual, setChangeFromUsual] = useState<string>("SAME");
  const [helpRequested, setHelpRequested] = useState<boolean>(false);
  const [freeformNotes, setFreeformNotes] = useState<string>("");
  const [moodScore, setMoodScore] = useState<number>(4);
  const [painLevel, setPainLevel] = useState<number>(0);
  const [sleepHours, setSleepHours] = useState<number>(7);

  // Idempotency key generated once per form session
  const [idempotencyKey] = useState<string>(() => {
    return `checkin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });

  const wellbeingOptions = [
    {
      value: "FEELING_WELL",
      label: "Sab Theek Hai (Feeling Well)",
      desc: "Aaj urja achhi hai, koi nayi takleef nahi.",
      icon: Smile,
      color: "border-emerald-500 bg-emerald-50 text-emerald-900",
      accent: "text-emerald-600",
    },
    {
      value: "FEELING_OKAY",
      label: "Theek-Thaak (Feeling Okay)",
      desc: "Aam roz jaisa din hai, thodi suvidha/thakan hai.",
      icon: Meh,
      color: "border-blue-500 bg-blue-50 text-blue-900",
      accent: "text-blue-600",
    },
    {
      value: "NOT_FEELING_WELL",
      label: "Tabiyat Theek Nahi (Not Well)",
      desc: "Thakan, kamzori ya sharirik bechaini lag rahi hai.",
      icon: Frown,
      color: "border-amber-500 bg-amber-50 text-amber-900",
      accent: "text-amber-600",
    },
    {
      value: "FEELING_MUCH_WORSE",
      label: "Zyada Kharaab Lag Raha Hai (Much Worse)",
      desc: "Pehle se kaafi zyada takleef ya dard hai.",
      icon: AlertOctagon,
      color: "border-rose-500 bg-rose-50 text-rose-900",
      accent: "text-rose-600",
    },
  ];

  const commonConcerns = [
    { id: "BODY_PAIN", label: "Sharir / Jodon Mein Dard (Pain)" },
    { id: "DIZZINESS", label: "Chakkar Aana (Dizziness)" },
    { id: "FATIGUE", label: "Zyada Thakan / Kamzori (Fatigue)" },
    { id: "APPETITE_LOSS", label: "Bhookh Kam Lagna (Poor Appetite)" },
    { id: "SLEEP_TROUBLE", label: "Neend Mein Dikkat (Sleep Issue)" },
    { id: "MEDICATION_MISSED", label: "Dawaai Chhooti (Missed Medicine)" },
    { id: "BREATHING_UNREST", label: "Saans Phoolna (Breathlessness)" },
    { id: "LONELINESS", label: "Man Udass Ya Akela (Low Mood)" },
  ];

  const changeOptions = [
    { value: "BETTER", label: "Pehle se behtar (Better than usual)", color: "text-emerald-700 bg-emerald-50 border-emerald-300" },
    { value: "SAME", label: "Roz jaisa (Same as usual)", color: "text-slate-800 bg-slate-50 border-slate-300" },
    { value: "WORSE", label: "Pehle se kharaab (Worse than usual)", color: "text-rose-700 bg-rose-50 border-rose-300" },
  ];

  const toggleConcern = (concernId: string) => {
    if (concernCategories.includes(concernId)) {
      setConcernCategories(concernCategories.filter((c) => c !== concernId));
    } else {
      setConcernCategories([...concernCategories, concernId]);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: SeniorCheckInSubmissionRequest = {
        general_wellbeing: generalWellbeing,
        concern_categories: concernCategories,
        change_from_usual: changeFromUsual,
        help_requested: helpRequested,
        freeform_notes: freeformNotes.trim() || undefined,
        mood_score: moodScore,
        pain_level: painLevel,
        sleep_hours: sleepHours,
        idempotency_key: idempotencyKey,
      };

      const res = await defaultApiClient.post<SeniorCheckInSubmissionResponse>(
        "/api/v1/senior/check-ins",
        payload
      );
      setSubmittedData(res);
    } catch (err: any) {
      setError(err?.message || "Check-in submit karne mein asuvidha aayi. Kripya punah prayas karein.");
    } finally {
      setLoading(false);
    }
  };

  // Submission Confirmation View
  if (submittedData) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-white border-2 border-emerald-300 rounded-2xl p-8 text-center shadow-lg space-y-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Shukriya! Aapki Tabiyat Ki Jaankari Darz Ho Gayi Hai
            </h2>
            <p className="text-base sm:text-lg text-emerald-800 font-semibold">
              {submittedData.confirmation_message}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-left space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 font-medium">Samay (Time):</span>
              <span className="font-bold text-slate-900">{submittedData.submission_time}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 font-medium">Aapka Status:</span>
              <span className="font-bold text-emerald-800">{submittedData.general_wellbeing_label}</span>
            </div>
            {submittedData.help_requested && (
              <div className="flex items-center gap-2 text-sm font-bold text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                <PhoneCall className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Samarth Care Coordinator jald aapse phone par sampark karenge.</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/senior"
              className="inline-flex items-center justify-center px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white text-base font-bold rounded-xl shadow min-h-[48px]"
            >
              Aaj Ki Care Par Lauten (Home)
            </Link>
            <Link
              href="/senior/help"
              className="inline-flex items-center justify-center px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-base font-bold rounded-xl min-h-[48px]"
            >
              Help & Callback History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Title & Progress Bar */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-teal-600" />
              Tabiyat Batayein (Wellbeing Check-in)
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium mt-1">
              Yeh 5 aasaan kadam aapki dekhbhal sunishchit karte hain.
            </p>
          </div>
          <span className="text-base font-extrabold text-teal-800 bg-teal-50 px-3.5 py-1.5 rounded-full border border-teal-200 self-start sm:self-center">
            Kadam {currentStep} / 5
          </span>
        </div>

        {/* Progress Track */}
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className="bg-teal-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          ></div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 text-rose-900 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-base">Rukavat Aayi</h4>
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Step 1: Overall Wellbeing */}
      {currentStep === 1 && (
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              Kadam 1: Aaj aap kaisa mehsoos kar rahe hain?
            </h3>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Neeche diye gaye vikalpon mein se ek chunein:
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {wellbeingOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = generalWellbeing === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGeneralWellbeing(opt.value)}
                  className={`w-full p-4 sm:p-5 rounded-2xl border-2 text-left transition-all flex items-start gap-4 min-h-[64px] ${
                    isSelected
                      ? `${opt.color} ring-2 ring-teal-600 shadow-md`
                      : "border-slate-200 hover:border-slate-300 bg-white text-slate-800"
                  }`}
                >
                  <Icon className={`w-8 h-8 flex-shrink-0 ${isSelected ? opt.accent : "text-slate-500"}`} />
                  <div>
                    <h4 className="text-lg font-extrabold">{opt.label}</h4>
                    <p className="text-sm font-medium text-slate-600 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 py-3.5 rounded-xl text-lg shadow min-h-[48px]"
            >
              <span>Aage Badhein (Next)</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Specific Concerns */}
      {currentStep === 2 && (
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              Kadam 2: Kya koi khaas takleef ya pareshani hai?
            </h3>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Jo laagu ho unhein chunein (agar koi takleef nahi hai toh seedhe &apos;Aage Badhein&apos; daba sakte hain):
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {commonConcerns.map((concern) => {
              const isSelected = concernCategories.includes(concern.id);
              return (
                <button
                  key={concern.id}
                  type="button"
                  onClick={() => toggleConcern(concern.id)}
                  className={`p-4 rounded-xl border-2 text-left font-bold text-base transition-all flex items-center justify-between min-h-[56px] ${
                    isSelected
                      ? "border-teal-600 bg-teal-50 text-teal-950 shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <span>{concern.label}</span>
                  {isSelected && <CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-3 rounded-xl text-base min-h-[48px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Peeche (Back)</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 py-3.5 rounded-xl text-lg shadow min-h-[48px]"
            >
              <span>Aage Badhein (Next)</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Change from Usual & Daily Rest */}
      {currentStep === 3 && (
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              Kadam 3: Pichhle dinon ki tulna mein kaisa hai?
            </h3>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Rozana ke hisab se badlav batayein:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {changeOptions.map((opt) => {
              const isSelected = changeFromUsual === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChangeFromUsual(opt.value)}
                  className={`p-4 rounded-xl border-2 text-center font-bold text-base transition-all min-h-[56px] ${
                    isSelected
                      ? `${opt.color} ring-2 ring-teal-600 shadow-sm`
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Simple sliders for sleep & mood */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-base font-bold text-slate-800">
                  Raat ko neend kitne ghante aayi?
                </label>
                <span className="text-lg font-extrabold text-teal-800 bg-teal-50 px-3 py-0.5 rounded-lg border border-teal-200">
                  {sleepHours} Ghante
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="0.5"
                value={sleepHours}
                onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-base font-bold text-slate-800">
                  Man kaisa hai? (Mood Score 1 se 5)
                </label>
                <span className="text-lg font-extrabold text-teal-800 bg-teal-50 px-3 py-0.5 rounded-lg border border-teal-200">
                  {moodScore} / 5
                </span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMoodScore(val)}
                    className={`flex-1 py-3 rounded-xl border-2 font-bold text-base min-h-[48px] ${
                      moodScore === val
                        ? "border-teal-600 bg-teal-50 text-teal-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-3 rounded-xl text-base min-h-[48px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Peeche (Back)</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 py-3.5 rounded-xl text-lg shadow min-h-[48px]"
            >
              <span>Aage Badhein (Next)</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Callback / Help Toggle & Freeform Notes */}
      {currentStep === 4 && (
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              Kadam 4: Kya aap Samarth team se phone par baat karna chahte hain?
            </h3>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Agar aapko koi madad chahiye, toh yahan chun sakte hain:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setHelpRequested(false)}
              className={`p-5 rounded-2xl border-2 text-left font-bold transition-all min-h-[64px] ${
                !helpRequested
                  ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <span>Nahi, abhi call ki zaroorat nahi</span>
              </div>
              <p className="text-xs font-medium text-slate-600 mt-1 pl-8">
                Bas meri aaj ki report darz kar lein.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setHelpRequested(true)}
              className={`p-5 rounded-2xl border-2 text-left font-bold transition-all min-h-[64px] ${
                helpRequested
                  ? "border-amber-600 bg-amber-50 text-amber-950 shadow-sm ring-2 ring-amber-500"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 text-lg">
                <PhoneCall className="w-6 h-6 text-amber-600" />
                <span>Haan, kripya mujhe call karein</span>
              </div>
              <p className="text-xs font-medium text-slate-600 mt-1 pl-8">
                Care coordinator jald aapse phone par baat karenge.
              </p>
            </button>
          </div>

          {/* Optional notes */}
          <div className="pt-2">
            <label className="block text-base font-bold text-slate-800 mb-1">
              Koi sandesh ya khaas baat likhna chahein? (Optional)
            </label>
            <textarea
              rows={3}
              value={freeformNotes}
              onChange={(e) => setFreeformNotes(e.target.value)}
              placeholder="Jaise: Aaj subah thoda sar dard tha, par dawaai lene ke baad theek hoon..."
              className="w-full text-base p-3.5 border-2 border-slate-300 rounded-xl focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-3 rounded-xl text-base min-h-[48px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Peeche (Back)</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(5)}
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 py-3.5 rounded-xl text-lg shadow min-h-[48px]"
            >
              <span>Aage Badhein (Review)</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Review & Submit */}
      {currentStep === 5 && (
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              Kadam 5: Jaankari Ki Pushti (Review & Submit)
            </h3>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Kripya ek baar dekh lein aur neeche &apos;Submit Karein&apos; dabayein:
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center text-base">
              <span className="text-slate-600 font-medium">Kaisa lag raha hai:</span>
              <span className="font-extrabold text-slate-900">
                {wellbeingOptions.find((o) => o.value === generalWellbeing)?.label}
              </span>
            </div>
            <div className="flex justify-between items-center text-base">
              <span className="text-slate-600 font-medium">Badlav (Change):</span>
              <span className="font-bold text-slate-900">
                {changeOptions.find((o) => o.value === changeFromUsual)?.label}
              </span>
            </div>
            <div className="flex justify-between items-center text-base">
              <span className="text-slate-600 font-medium">Neend:</span>
              <span className="font-bold text-slate-900">{sleepHours} Ghante</span>
            </div>
            <div className="flex justify-between items-center text-base">
              <span className="text-slate-600 font-medium">Phone Call Chahiye:</span>
              <span className={`font-extrabold ${helpRequested ? "text-amber-700" : "text-emerald-700"}`}>
                {helpRequested ? "Haan (Phone Call Request)" : "Nahi (Bas check-in)"}
              </span>
            </div>
            {concernCategories.length > 0 && (
              <div>
                <span className="text-sm font-semibold text-slate-600">Darz Takleefein:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {concernCategories.map((c) => (
                    <span key={c} className="text-xs font-bold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-md">
                      {commonConcerns.find((cc) => cc.id === c)?.label || c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {freeformNotes && (
              <div className="pt-2 border-t border-slate-200">
                <span className="text-xs font-semibold text-slate-500">Aapka Sandesh:</span>
                <p className="text-sm text-slate-800 italic mt-0.5">&quot;{freeformNotes}&quot;</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={loading}
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-3 rounded-xl text-base min-h-[48px] disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Peeche (Back)</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-8 py-4 rounded-xl text-xl shadow-lg min-h-[56px] transition-transform active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Darz Ho Raha Hai...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  <span>Submit Karein</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

