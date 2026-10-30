"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Users,
  Bell,
  ShieldAlert,
  Building2,
  UserCog,
  FileText,
  History,
  LogOut,
  LogIn,
  MapPin,
  Calendar,
  ClipboardList,
  Heart,
  PhoneCall,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { registerWebPushToken } from "@/services/fcm";
import { PushEnableButton } from "./PushEnableButton";
import { useState, useEffect } from "react";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { metrics, service } = useApp();
  const { user, isAuthenticated, isAdmin, isCityManager, isCaretaker, isFamily, isSenior, logout } = useAuth();
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);

  useEffect(() => {
    if (isAuthenticated && isCaretaker) {
      registerWebPushToken().catch(() => {});
      const fetchCount = async () => {
        try {
          const count = await service.getUnreadNotificationCount();
          setUnreadNotifCount(count);
        } catch {}
      };
      fetchCount();
      const interval = setInterval(fetchCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, isCaretaker, service]);

  // Dynamic role-based navigation items
  let navItems: Array<{ label: string; href: string; icon: any; badge?: number }> = [];

  if (isAdmin) {
    navItems = [
      { label: "Overview", href: "/admin", icon: Activity },
      { label: "Cities", href: "/admin/cities", icon: Building2 },
      { label: "Staff", href: "/admin/staff", icon: UserCog },
      { label: "Seniors", href: "/admin/seniors", icon: Users },
      { label: "AI Alerts", href: "/admin/alerts", icon: Bell, badge: metrics?.active_alerts_count || undefined },
      { label: "Reports", href: "/admin/reports", icon: FileText },
      { label: "Audit Logs", href: "/admin/audit-logs", icon: History },
    ];
  } else if (isCityManager) {
    navItems = [
      { label: "City Dashboard", href: "/city-manager", icon: Activity },
      { label: "My Seniors", href: "/city-manager/seniors", icon: Users },
      { label: "Caretakers", href: "/city-manager/caretakers", icon: UserCog },
      { label: "Visits", href: "/city-manager/visits", icon: Calendar },
      { label: "City Alerts", href: "/city-manager/alerts", icon: Bell, badge: metrics?.active_alerts_count || undefined },
      { label: "Reports", href: "/city-manager/reports", icon: FileText },
    ];
  } else if (isCaretaker) {
    navItems = [
      { label: "Today's Schedule", href: "/caretaker", icon: Calendar },
      { label: "My Seniors", href: "/caretaker/seniors", icon: Users },
      { label: "Visit History", href: "/caretaker/history", icon: History },
      { label: "Notifications", href: "/caretaker/notifications", icon: Bell, badge: unreadNotifCount || undefined },
    ];
  } else if (isFamily) {
    navItems = [
      { label: "Family Home", href: "/family", icon: Heart },
      { label: "Visits & Schedule", href: "/family/visits", icon: Calendar },
      { label: "Contact & Requests", href: "/family/contact", icon: PhoneCall },
      { label: "Profile & Privacy", href: "/family/profile", icon: UserCog },
    ];
  } else if (isSenior) {
    navItems = [
      { label: "Aaj Ki Care", href: "/senior", icon: Heart },
      { label: "Tabiyat Batayein", href: "/senior/check-in", icon: ClipboardList },
      { label: "Meri Visits", href: "/senior/visits", icon: Calendar },
      { label: "Help Chahiye", href: "/senior/help", icon: PhoneCall },
      { label: "Meri Care Team", href: "/senior/care-team", icon: Users },
      { label: "Meri Profile", href: "/senior/profile", icon: UserCog },
    ];
  } else {
    // Default / Coordinator View
    navItems = [
      { label: "Dashboard", href: "/dashboard", icon: Activity },
      { label: "Seniors Directory", href: "/seniors", icon: Users },
      { label: "Alerts Center", href: "/alerts", icon: Bell, badge: metrics?.active_alerts_count || undefined },
    ];
  }

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      {/* Synthetic Demo Banner */}
      <div className="bg-amber-500 text-amber-950 px-4 py-1 text-xs font-semibold flex items-center justify-between shadow-inner">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>
            {service.isMock ? "SYNTHETIC DEMO MODE" : "LIVE BACKEND CONNECTED"} — Multi-Role Eldercare Decision Support Platform
          </span>
        </div>
        <span className="hidden md:inline-block text-[11px] font-mono bg-amber-400/80 px-2 py-0.5 rounded">
          Sahaj AI v3.0
        </span>
      </div>

      {/* Main Nav Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <div className="flex items-center gap-6">
            <Link
              href={isAdmin ? "/admin" : isCityManager ? "/city-manager" : isCaretaker ? "/caretaker" : "/dashboard"}
              className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg p-1"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                S
              </div>
              <div>
                <span className="font-bold text-slate-900 tracking-tight text-base leading-none">
                  Sahaj<span className="text-brand-600">Care</span>
                </span>
                <span className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  {isAdmin ? "Admin Portal" : isCityManager ? "City Manager" : isCaretaker ? "Caretaker Portal" : "AI Early Warning"}
                </span>
              </div>
            </Link>

            {/* Nav Links */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin" && item.href !== "/city-manager" && item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isActive
                        ? "bg-slate-100 text-brand-700 font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Profile & Auth Status */}
          <div className="flex items-center gap-3">
            {isAuthenticated && isCaretaker && (
              <Link
                href="/caretaker/notifications"
                className="relative p-2 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Care Coordinator Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full border-2 border-white shadow-sm">
                    {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                  </span>
                )}
              </Link>
            )}
            {isAuthenticated && <PushEnableButton />}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-bold text-slate-800 leading-tight">
                    {user.full_name || user.display_name || user.email}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.2 rounded">
                      {user.role.replace("_", " ")}
                    </span>
                    {(user.staff_profile?.city_id || user.city) && (
                      <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {(user.staff_profile?.city_id?.replace("CITY_", "") || user.city)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shadow-inner uppercase">
                  {(user.full_name || user.display_name || user.email || "U").charAt(0)}
                </div>

                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="flex items-center gap-1 p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Portal Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="lg:hidden border-t border-slate-100 px-3 py-2 flex items-center justify-around bg-slate-50/50 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && item.href !== "/city-manager" && item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${
                isActive ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-0.5 px-1 bg-red-100 text-red-700 text-[9px] font-bold rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </header>
  );
};
