"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { defaultApiClient } from "@/services/apiClient";
import { SeniorProfileResponse, SeniorProfileUpdateRequest } from "@/types/api";
import {
  UserCog,
  ShieldCheck,
  Phone,
  User,
  Heart,
  AlertCircle,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Save,
  MapPin,
  Lock,
} from "lucide-react";

export default function SeniorProfilePage() {
  const [profile, setProfile] = useState<SeniorProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editable fields
  const [preferredLanguage, setPreferredLanguage] = useState<string>("Hindi");
  const [emergencyName, setEmergencyName] = useState<string>("");
  const [emergencyPhone, setEmergencyPhone] = useState<string>("");

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await defaultApiClient.get<SeniorProfileResponse>("/api/v1/senior/profile");
      setProfile(res);
      setPreferredLanguage(res.preferred_language || "Hindi");
      setEmergencyName(res.emergency_contact_name || "");
      setEmergencyPhone(res.emergency_contact_phone || "");
    } catch (err: any) {
      setError(err?.message || "Profile load karne mein dikkat aayi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const payload: SeniorProfileUpdateRequest = {
        preferred_language: preferredLanguage,
        emergency_contact_name: emergencyName.trim() || undefined,
        emergency_contact_phone: emergencyPhone.trim() || undefined,
      };

      const updated = await defaultApiClient.patch<SeniorProfileResponse>(
        "/api/v1/senior/profile",
        payload
      );
      setProfile(updated);
      setSuccessMsg("Aapki profile safaltapoorvak update ho gayi hai.");
    } catch (err: any) {
      setError(err?.message || "Profile update nahi ho paayi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-teal-600" />
            Meri Profile & Privacy (DPDP 2023)
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium mt-1">
            Aapki vyaktigat jaankari aur parivar ke authorized links.
          </p>
        </div>
        <Link
          href="/senior"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold text-base px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home Lauten</span>
        </Link>
      </div>

      {loading && (
        <div className="min-h-[40vh] flex flex-col items-center justify-center py-12">
          <Loader2 className="w-10 h-10 animate-spin text-teal-600 mb-3" />
          <p className="text-lg font-bold text-slate-700">Aapki profile laayi ja rahi hai...</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 text-rose-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0" />
            <p className="text-base font-semibold">{error}</p>
          </div>
          <button
            onClick={fetchProfile}
            className="px-4 py-2 bg-teal-600 text-white font-bold rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 text-emerald-950 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <p className="text-base font-bold">{successMsg}</p>
        </div>
      )}

      {profile && (
        <div className="space-y-6">
          {/* Read-Only Essential Identity Card */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-teal-600" />
              <span>Vyaktigat Vivaran (Personal Details)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm sm:text-base">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Naam:</span>
                <strong className="text-lg text-slate-900 font-extrabold">{profile.name}</strong>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Umar (Age):</span>
                <strong className="text-lg text-slate-900 font-extrabold">{profile.age} Saal</strong>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Shehar (City):</span>
                <strong className="text-lg text-slate-900 font-extrabold">{profile.city_name}</strong>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Living Arrangement:</span>
                <strong className="text-lg text-slate-900 font-extrabold">{profile.living_arrangement.replace(/_/g, " ")}</strong>
              </div>
            </div>
          </div>

          {/* Editable Self-Service Profile Preferences */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <UserCog className="w-5 h-5 text-teal-600" />
              <span>Sampark & Bhasha Preferences</span>
            </h3>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-base font-bold text-slate-800 mb-1">
                  Pasandida Bhasha (Preferred Language):
                </label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full text-base p-3 border-2 border-slate-300 rounded-xl focus:border-teal-600 focus:outline-none min-h-[48px]"
                >
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="English">English</option>
                  <option value="Punjabi">Punjabi (ਪੰਜਾਬੀ)</option>
                  <option value="Bengali">Bengali (বাংলা)</option>
                  <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-bold text-slate-800 mb-1">
                    Emergency Contact Ka Naam:
                  </label>
                  <input
                    type="text"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="e.g. Pooja Gupta"
                    className="w-full text-base p-3 border-2 border-slate-300 rounded-xl focus:border-teal-600 focus:outline-none min-h-[48px]"
                  />
                </div>

                <div>
                  <label className="block text-base font-bold text-slate-800 mb-1">
                    Emergency Contact Phone:
                  </label>
                  <input
                    type="tel"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full text-base p-3 border-2 border-slate-300 rounded-xl focus:border-teal-600 focus:outline-none min-h-[48px]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold px-6 py-3 rounded-xl text-base shadow min-h-[48px] disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Save Ho Raha Hai...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>Badlav Save Karein</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Authorized Family Members Section */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-600" />
              <span>Anumodit Parivar Sadasya (Authorized Family Members)</span>
            </h3>
            <p className="text-sm text-slate-600">
              Yeh vyakti aapke care updates aur visit summary dekhne ke liye authorized hain:
            </p>

            {profile.authorized_family_members.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-slate-500">
                <p className="text-sm font-medium">Abhi koi parivar sadasya linked nahi hai.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.authorized_family_members.map((fam) => (
                  <div
                    key={fam.link_id}
                    className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900">{fam.family_member_name}</h4>
                      <p className="text-xs font-semibold text-rose-700">Sambandh: {fam.relationship_type}</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Active Link
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DPDP 2023 Consent & Privacy Card */}
          <div className="bg-teal-50 border-2 border-teal-300 rounded-2xl p-6 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-teal-700" />
              <h4 className="text-lg font-bold text-teal-950">Aapka Data Surakshit Hai (DPDP Act 2023)</h4>
            </div>
            <p className="text-sm text-teal-800 leading-relaxed font-medium">
              Sahaj aapki gopaniyata (privacy) ka samman karta hai. Aapka data keval aapki dekhbhal aur suraksha ke liye upyog kiya jata hai. Kisi bhi teesre paksh (third-party) ko bina aapki anumati ke nahi diya jata.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

