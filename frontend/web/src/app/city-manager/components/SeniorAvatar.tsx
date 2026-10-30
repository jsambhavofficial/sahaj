"use client";

import React, { useState } from "react";

interface SeniorAvatarProps {
  name: string;
  gender?: "Female" | "Male" | string;
  size?: number; // e.g. 64 or 32
  className?: string;
  imageUrl?: string;
}

export default function SeniorAvatar({
  name,
  gender = "Female",
  size = 64,
  className = "",
  imageUrl,
}: SeniorAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const isFemale = gender === "Female" || name.toLowerCase().includes("devi") || name.toLowerCase().includes("sharma") || name.toLowerCase().includes("bai") || name.toLowerCase().includes("rani");

  // Fallback authentic elderly Indian portraits
  // Female: User-uploaded elder Indian grandmother photos
  // Male: Authentic elderly grandfather portraits
  const elderFemaleImg1 = "/images/seniors/elder_woman_1.jpg";
  const elderFemaleImg2 = "/images/seniors/elder_woman_2.jpg";
  const elderMaleImg = "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&q=80&w=350";

  // Pick female photo based on name hash
  const nameCode = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const defaultFemaleImg = nameCode % 2 === 0 ? elderFemaleImg1 : elderFemaleImg2;

  const resolvedUrl = imageUrl || (isFemale ? defaultFemaleImg : elderMaleImg);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "SR";

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px`, minWidth: `${size}px`, minHeight: `${size}px`, maxWidth: `${size}px`, maxHeight: `${size}px` }}
      className={`relative rounded-full overflow-hidden border-2 border-amber-200/80 bg-amber-50 shadow-xs shrink-0 flex items-center justify-center select-none ${className}`}
    >
      {!imgFailed ? (
        <img
          src={resolvedUrl}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        /* Authentic Indian Elderly Senior SVG illustration */
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {isFemale ? (
            /* Elderly Indian Grandmother (Savitri Devi / Kamala Sharma) */
            <>
              <circle cx="32" cy="32" r="32" fill="#FDF6E2" />
              {/* Saree / Shawl */}
              <path d="M6 64C6 50 18 44 32 44C46 44 58 50 58 64H6Z" fill="#D97706" opacity="0.85" />
              <path d="M14 64C16 52 24 46 32 46C40 46 48 52 50 64H14Z" fill="#F59E0B" />
              <path d="M22 64C24 55 28 50 32 50C36 50 40 55 42 64H22Z" fill="#FEF3C7" />
              {/* Neck */}
              <rect x="28" y="36" width="8" height="10" rx="4" fill="#E8B488" />
              {/* Head / Face */}
              <circle cx="32" cy="27" r="14" fill="#F0C29C" />
              {/* Gray Hair (Bun on top) */}
              <circle cx="32" cy="12" r="6" fill="#94A3B8" />
              {/* Gray Hair sides */}
              <path d="M18 25C18 16 24 13 32 13C40 13 46 16 46 25C46 21 44 15 32 15C20 15 18 21 18 25Z" fill="#CBD5E1" />
              <path d="M18 23C18 18 23 14 32 14C41 14 46 18 46 23C43 17 38 15 32 15C26 15 21 17 18 23Z" fill="#64748B" />
              {/* Spectacles / Glasses */}
              <circle cx="27" cy="26" r="3.5" stroke="#475569" strokeWidth="1.2" fill="#FFFFFF" fillOpacity="0.4" />
              <circle cx="37" cy="26" r="3.5" stroke="#475569" strokeWidth="1.2" fill="#FFFFFF" fillOpacity="0.4" />
              <path d="M30.5 26H33.5" stroke="#475569" strokeWidth="1.2" />
              {/* Eyes */}
              <circle cx="27" cy="26" r="1.2" fill="#1E293B" />
              <circle cx="37" cy="26" r="1.2" fill="#1E293B" />
              {/* Bindi (Traditional Red) */}
              <circle cx="32" cy="21" r="1.2" fill="#DC2626" />
              {/* Warm gentle smile */}
              <path d="M28 32C29.5 34 34.5 34 36 32" stroke="#9A3412" strokeWidth="1.4" strokeLinecap="round" />
            </>
          ) : (
            /* Elderly Indian Grandfather (Ramesh Sen / Rameshwar Prasad) */
            <>
              <circle cx="32" cy="32" r="32" fill="#EFF6FF" />
              {/* Kurta */}
              <path d="M8 64C8 50 18 45 32 45C46 45 56 50 56 64H8Z" fill="#1E3A8A" opacity="0.8" />
              <path d="M18 64C20 54 26 48 32 48C38 48 44 54 46 64H18Z" fill="#3B82F6" />
              {/* Neck */}
              <rect x="28" y="36" width="8" height="10" rx="4" fill="#E8B488" />
              {/* Head */}
              <circle cx="32" cy="26" r="14" fill="#F0C29C" />
              {/* Gray Hair */}
              <path d="M18 22C18 14 24 12 32 12C40 12 46 14 46 22C46 16 42 13 32 13C22 13 18 16 18 22Z" fill="#94A3B8" />
              {/* Spectacles */}
              <rect x="23" y="22" width="7" height="6" rx="2" stroke="#334155" strokeWidth="1.2" fill="#FFFFFF" fillOpacity="0.3" />
              <rect x="34" y="22" width="7" height="6" rx="2" stroke="#334155" strokeWidth="1.2" fill="#FFFFFF" fillOpacity="0.3" />
              <path d="M30 25H34" stroke="#334155" strokeWidth="1.2" />
              {/* Eyes */}
              <circle cx="26.5" cy="25" r="1" fill="#1E293B" />
              <circle cx="37.5" cy="25" r="1" fill="#1E293B" />
              {/* Mustache */}
              <path d="M26 31C28 30 31 31 32 32C33 31 36 30 38 31" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
              {/* Smile */}
              <path d="M29 34C30.5 35 33.5 35 35 34" stroke="#9A3412" strokeWidth="1.2" strokeLinecap="round" />
            </>
          )}
        </svg>
      )}
    </div>
  );
}

