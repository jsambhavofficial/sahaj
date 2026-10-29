"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Search,
  Send,
  User,
  Phone,
  Clock,
  CheckCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import SeniorAvatar from "../components/SeniorAvatar";

interface MessageItem {
  id: string;
  senior_id: string;
  sender_name: string;
  recipient_name: string;
  phone: string;
  type: "SMS" | "WHATSAPP" | "SYSTEM_AI";
  text: string;
  timestamp: string;
  status: "DELIVERED" | "READ";
  direction: "OUTBOUND" | "INBOUND";
}

const INITIAL_MESSAGES: MessageItem[] = [
  {
    id: "MSG_001",
    senior_id: "S0054",
    sender_name: "Sahaj Care Coordinator",
    recipient_name: "Savitri Devi",
    phone: "+91 98112 34567",
    type: "SMS",
    text: "Namaste Savitriji, your field caretaker visit is confirmed for today at 2:00 PM. Please keep your morning prescription strip handy.",
    timestamp: "Today, 10:30 AM",
    status: "READ",
    direction: "OUTBOUND",
  },
  {
    id: "MSG_002",
    senior_id: "S0054",
    sender_name: "Rajesh Verma (Son)",
    recipient_name: "Sahaj Care Team",
    phone: "+91 98112 78901",
    type: "WHATSAPP",
    text: "Received the morning check-in alert. Mother mentioned feeling slightly dizzy. Caretaker please check her BP upon arrival.",
    timestamp: "Today, 09:45 AM",
    status: "READ",
    direction: "INBOUND",
  },
  {
    id: "MSG_003",
    senior_id: "S0012",
    sender_name: "Priya (Sahaj AI)",
    recipient_name: "Kamala Sharma",
    phone: "+91 98101 23456",
    type: "SYSTEM_AI",
    text: "Daily Wellness Check-In successfully recorded at 9:14 AM. Routine vitals normal, fatigue noted.",
    timestamp: "Today, 09:15 AM",
    status: "DELIVERED",
    direction: "OUTBOUND",
  },
  {
    id: "MSG_004",
    senior_id: "S0021",
    sender_name: "Sahaj Care Coordinator",
    recipient_name: "Amit Mehta (Son)",
    phone: "+91 98200 78901",
    type: "WHATSAPP",
    text: "Weekly wellbeing report for Kavita Mehta ji has been uploaded to the family transparency portal.",
    timestamp: "Yesterday, 05:20 PM",
    status: "READ",
    direction: "OUTBOUND",
  },
];

export default function CityManagerMessagesPage() {
  const [messages, setMessages] = useState<MessageItem[]>(INITIAL_MESSAGES);
  const [search, setSearch] = useState("");
  const [activeRecipient, setActiveRecipient] = useState<string>("S0054");
  const [replyText, setReplyText] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);

  const filtered = messages.filter(
    (m) =>
      m.recipient_name.toLowerCase().includes(search.toLowerCase()) ||
      m.sender_name.toLowerCase().includes(search.toLowerCase()) ||
      m.senior_id.toLowerCase().includes(search.toLowerCase()) ||
      m.text.toLowerCase().includes(search.toLowerCase())
  );

  const activeThread = messages.filter((m) => m.senior_id === activeRecipient);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    const newMsg: MessageItem = {
      id: `MSG_${Date.now()}`,
      senior_id: activeRecipient,
      sender_name: "City Manager (Direct)",
      recipient_name: activeRecipient === "S0054" ? "Savitri Devi" : "Senior / Family",
      phone: "+91 98112 34567",
      type: "SMS",
      text: replyText.trim(),
      timestamp: "Just now",
      status: "DELIVERED",
      direction: "OUTBOUND",
    };

    setMessages((prev) => [newMsg, ...prev]);
    setReplyText("");
    setSendSuccess(true);
    setTimeout(() => setSendSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-[#1c3e35]" />
            <span>Senior &amp; Family Message Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time SMS notices, WhatsApp alerts, and automated check-in conversational dispatches.
          </p>
        </div>

        {sendSuccess && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Notice dispatched successfully!</span>
          </div>
        )}
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Thread List (4 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col h-[650px]">
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages by name or text..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Active Conversations ({filtered.length})
            </p>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filtered.map((item) => {
              const isSelected = activeRecipient === item.senior_id;
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveRecipient(item.senior_id)}
                  className={`p-4 transition-colors cursor-pointer text-xs space-y-1.5 ${
                    isSelected ? "bg-emerald-50/70 border-l-4 border-emerald-600" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <span>{item.recipient_name}</span>
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {item.senior_id}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">{item.timestamp}</span>
                  </div>

                  <p className="text-slate-600 truncate">{item.text}</p>

                  <div className="flex items-center gap-2 pt-1 text-[10px]">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        item.type === "WHATSAPP"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.type === "SYSTEM_AI"
                          ? "bg-teal-100 text-teal-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <CheckCheck className="w-3 h-3 text-emerald-600" />
                      {item.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Chat Stream & Quick Dispatch (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-xs flex flex-col h-[650px] overflow-hidden">
          {/* Thread Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <SeniorAvatar name={activeRecipient === "S0054" ? "Savitri Devi" : "Kamala Sharma"} size={42} />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {activeRecipient === "S0054" ? "Savitri Devi & Family" : "Kamala Sharma & Family"}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {activeRecipient} • SMS &amp; WhatsApp Notifications Active
                </p>
              </div>
            </div>

            <Link
              href={`/city-manager/seniors/${activeRecipient}`}
              className="text-xs font-bold text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl transition-colors inline-flex items-center gap-1"
            >
              <span>Full Dossier</span>
              <ArrowRight className="w-3 h-3 text-teal-600" />
            </Link>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/30">
            {activeThread.map((msg) => {
              const isOut = msg.direction === "OUTBOUND";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[80%] ${isOut ? "ml-auto items-end" : "mr-auto items-start"}`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                    <span className="font-bold text-slate-700">{msg.sender_name}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-sm font-medium shadow-2xs leading-relaxed ${
                      isOut
                        ? "bg-[#1c3e35] text-white rounded-br-none"
                        : "bg-white border border-slate-200 text-slate-800 rounded-bl-none"
                    }`}
                  >
                    <p>{msg.text}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                    <span className="font-semibold uppercase">{msg.type}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold">{msg.status}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compose Form */}
          <form onSubmit={handleSend} className="p-3.5 border-t border-slate-100 bg-white flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type an urgent message or care notification..."
              className="flex-1 text-xs p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
            />
            <button
              type="submit"
              disabled={!replyText.trim()}
              className="p-3 bg-[#1c3e35] hover:bg-[#255246] disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

