"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Users,
  UserCheck,
  Calendar,
  Bell,
  FileText,
  Settings,
  LogOut,
  Search,
  MapPin,
  CalendarDays,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { CityManagerProvider, useCityManager } from "@/context/CityManagerContext";

function CityManagerLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { searchQuery, setSearchQuery, openAlertsCount } = useCityManager();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState("10:04 pm");
  const [currentDateStr, setCurrentDateStr] = useState("Thu, 29 Oct 2026");

  // Keep live time updated
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      const date = now.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      setCurrentTimeStr(time.toLowerCase());
      setCurrentDateStr(date);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000 * 30);
    return () => clearInterval(interval);
  }, []);

  // Icon-only navigation rail destinations matching the reference design
  const navItems = [
    { label: "Overview", href: "/city-manager", icon: Home },
    { label: "Seniors", href: "/city-manager/seniors", icon: Users },
    { label: "Coordinators", href: "/city-manager/caretakers", icon: UserCheck },
    {
      label: "Alerts",
      href: "/city-manager/alerts",
      icon: Bell,
      badge: openAlertsCount > 0 ? openAlertsCount : undefined,
    },
    { label: "Reports", href: "/city-manager/reports", icon: FileText },
  ];

  const managerName = user?.display_name || user?.full_name || "Manager";
  const managerCity = user?.city || "All cities";
  const managerInitials = managerName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex antialiased font-sans">
      {/* ========================================================= */}
      {/* 1. SLIM WHITE ICON-ONLY NAVIGATION RAIL (Matching Reference) */}
      {/* ========================================================= */}
      <aside className="hidden lg:flex flex-col w-[76px] bg-white border-r border-slate-200/80 shrink-0 sticky top-0 h-screen select-none z-40 items-center justify-between py-5 shadow-[2px_0_12px_rgba(0,0,0,0.02)]">
        {/* Top: Sahaj AI Logo Emblem & Title */}
        <div className="flex flex-col items-center space-y-1.5">
          <Link
            href="/city-manager"
            className="group flex flex-col items-center focus:outline-none"
            title="Sahaj AI - City Care Portal"
          >
            {/* Logo Emblem (Caring hands/leaf motif matching reference) */}
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#0d9488] via-[#14b8a6] to-[#2dd4bf] text-white p-1 flex items-center justify-center shadow-md shadow-teal-500/20 group-hover:scale-105 transition-all">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" opacity="0.3" />
                <circle cx="12" cy="8" r="3.5" />
                <path d="M7 16c0-2.5 2.5-4 5-4s5 1.5 5 4v1H7v-1z" />
              </svg>
            </div>
            <div className="text-center mt-1">
              <span className="block text-[10px] font-black text-slate-900 tracking-tight leading-none">
                Sahaj AI
              </span>
              <span className="block text-[7.5px] font-semibold text-slate-400 tracking-tight leading-none mt-0.5">
                City Care Portal
              </span>
            </div>
          </Link>
        </div>

        {/* Middle Navigation Rail Items */}
        <nav aria-label="Main sidebar" className="flex flex-col items-center space-y-3.5 my-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === "/city-manager"
                ? pathname === "/city-manager"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <div key={item.label} className="relative group flex items-center justify-center">
                {/* Active Left Vertical Accent Indicator */}
                {isActive && (
                  <span
                    className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-[#0d9488] rounded-r-full shadow-xs"
                    aria-hidden="true"
                  />
                )}

                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative ${
                    isActive
                      ? "bg-[#e6f7f3] text-[#0d9488] shadow-xs"
                      : "text-slate-400 hover:text-slate-800 hover:bg-slate-100/80"
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />

                  {/* Badge (e.g. Alerts count 17) */}
                  {item.badge !== undefined && (
                    <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-rose-500 text-white text-[9.5px] font-black rounded-full flex items-center justify-center shadow-xs">
                      {item.badge}
                    </span>
                  )}
                </Link>

                {/* Floating Tooltip */}
                <div className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
                  {item.label}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom: Sign Out Action */}
        <div className="relative group flex items-center justify-center">
          <button
            onClick={handleLogout}
            aria-label="Sign Out"
            className="w-11 h-11 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all cursor-pointer border border-transparent hover:border-rose-100"
          >
            <LogOut className="w-5 h-5 stroke-[2.2]" />
          </button>
          <div className="pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
            Sign Out
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MOBILE SIDEBAR DRAWER                                   */}
      {/* ========================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="relative flex flex-col w-72 max-w-[85%] bg-white text-slate-800 h-full z-10 shadow-2xl p-5 justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#0d9488] text-white flex items-center justify-center">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">Sahaj AI</h2>
                    <p className="text-[10px] text-slate-400 font-semibold">City Care Portal</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1 pt-4">
                {navItems.map((item) => {
                  const isActive =
                    item.href === "/city-manager"
                      ? pathname === "/city-manager"
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold ${
                        isActive
                          ? "bg-[#e6f7f3] text-[#0d9488]"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-rose-500 text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. MAIN APPLICATION CONTAINER (Top Bar + Dynamic View Area) */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Modern Clean Top Bar (Matching Reference) */}
        <header className="h-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 bg-[#f8fafc]/90 backdrop-blur-md border-b border-slate-200/50">
          {/* Left: Mobile Toggle & Global Search Box with ⌘K Badge */}
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-white border border-slate-200 shadow-2xs"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    router.push(`/city-manager/seniors?q=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
                placeholder="Search seniors by name or ID, then press Enter"
                className="w-full pl-10 pr-14 py-2.5 bg-white hover:bg-slate-50/80 focus:bg-white border border-slate-200/90 focus:border-teal-500 rounded-full text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-3 focus:ring-teal-500/15 transition-all shadow-2xs"
              />

            </div>
          </div>

          {/* Right Controls: City Scope Pill, Date/Time Pill, Alerts Bell, Manager Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
            {/* 1. City Scope Selector Pill */}
            <div className="hidden md:flex items-center gap-2 bg-white border border-slate-200/80 rounded-2xl px-3.5 py-1.5 shadow-2xs">
              <div className="w-7 h-7 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-black text-slate-900 leading-tight">
                    {managerCity}
                  </p>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>
                <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                  Scope
                </p>
              </div>
            </div>

            {/* 2. Date & Time Pill */}
            <div className="hidden lg:flex items-center gap-2 bg-white border border-slate-200/80 rounded-2xl px-3.5 py-1.5 shadow-2xs">
              <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-slate-900 leading-tight">
                  {currentDateStr}
                </p>
                <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                  {currentTimeStr}
                </p>
              </div>
            </div>

            {/* 3. Notification Bell with Badge */}
            <Link
              href="/city-manager/alerts"
              className="relative p-2.5 bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all shadow-2xs cursor-pointer"
              title={`${openAlertsCount} Open AI Alerts`}
            >
              <Bell className="w-4 h-4" />
              {openAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[9.5px] font-black rounded-full flex items-center justify-center shadow-xs">
                  {openAlertsCount}
                </span>
              )}
            </Link>

            {/* 4. Manager Profile Pill with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 bg-white border border-slate-200/80 p-1.5 pr-3 rounded-2xl hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-[#0d9488] text-white flex items-center justify-center font-black text-xs shadow-xs">
                  {managerInitials}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-black text-slate-900 leading-tight">
                    {managerName}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 leading-none mt-0.5">
                    Organization manager
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {/* Profile Dropdown Menu */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-scaleUp">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{managerName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <Link
                    href="/city-manager/seniors"
                    onClick={() => setUserDropdownOpen(false)}
                    className="block px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium"
                  >
                    Seniors
                  </Link>
                  <Link
                    href="/city-manager/caretakers"
                    onClick={() => setUserDropdownOpen(false)}
                    className="block px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium"
                  >
                    Coordinators
                  </Link>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7 overflow-x-hidden">
          <div className="max-w-[1680px] mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function CityManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CityManagerProvider>
      <CityManagerLayoutInner>{children}</CityManagerLayoutInner>
    </CityManagerProvider>
  );
}
