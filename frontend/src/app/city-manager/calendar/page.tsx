"use client";

import React, { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  MapPin,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import SeniorAvatar from "../components/SeniorAvatar";

export default function CityManagerCalendarPage() {
  const [selectedDay, setSelectedDay] = useState(28);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const events: Record<number, Array<{ id: string; time: string; senior: string; caretaker: string; type: string }>> = {
    28: [
      { id: "V1", time: "09:00 AM", senior: "Mrs. Deshpande (S0007)", caretaker: "Deepak Kumar", type: "Vitals Check" },
      { id: "V2", time: "10:00 AM", senior: "Mr. Kulkarni (S0011)", caretaker: "Deepak Kumar", type: "Physiotherapy" },
      { id: "V3", time: "11:30 AM", senior: "Mrs. Mehta (S0021)", caretaker: "Sunita Patil", type: "Medication Refill" },
      { id: "V4", time: "02:00 PM", senior: "Mr. Shah (S0018)", caretaker: "Ramesh Yadav", type: "Mobility Support" },
      { id: "V5", time: "04:00 PM", senior: "Mrs. Nair (S0015)", caretaker: "Sunita Patil", type: "Routine Wellness" },
    ],
    29: [
      { id: "V6", time: "09:30 AM", senior: "Savitri Devi (S0054)", caretaker: "Deepak Kumar", type: "Post-fall Follow-up" },
      { id: "V7", time: "01:00 PM", senior: "Kamala Sharma (S0012)", caretaker: "Ramesh Yadav", type: "BP Inspection" },
    ],
  };

  const currentEvents = events[selectedDay] || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-[#1c3e35]" />
            <span>Field Care Schedule &amp; Calendar</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Master monthly calendar tracking all municipal caretaker home visits and clinical follow-ups.
          </p>
        </div>

        <Link
          href="/city-manager/visits"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1c3e35] hover:bg-[#255246] text-white text-xs font-bold rounded-xl shadow-xs transition-colors self-start sm:self-auto"
        >
          <span>View All Visits List</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Grid (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-lg font-black text-slate-900">August 2025</h2>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2">
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
            <div>Sun</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const hasEvents = !!events[day];
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`h-16 p-2 rounded-2xl flex flex-col justify-between transition-all border text-left cursor-pointer ${
                    isSelected
                      ? "bg-[#1c3e35] text-white border-[#1c3e35] shadow-sm"
                      : hasEvents
                      ? "bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/60 text-slate-900"
                      : "bg-slate-50/50 border-slate-100 hover:bg-slate-100/60 text-slate-600"
                  }`}
                >
                  <span className={`text-xs font-bold ${isSelected ? "text-white" : "text-slate-800"}`}>
                    {day}
                  </span>
                  {hasEvents && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold truncate ${
                        isSelected ? "bg-emerald-400 text-slate-950" : "bg-emerald-200 text-emerald-950"
                      }`}
                    >
                      {events[day].length} Visits
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900">
              Agenda for August {selectedDay}, 2025
            </h3>
            <p className="text-xs text-slate-500">
              {currentEvents.length} scheduled visits
            </p>
          </div>

          {currentEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Calendar className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-medium">No field visits scheduled for this day.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {evt.time}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {evt.type}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900">{evt.senior}</h4>
                  <p className="text-slate-500 text-[11px]">
                    Assigned: <strong className="text-slate-700">{evt.caretaker}</strong>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

