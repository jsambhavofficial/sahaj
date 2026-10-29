"use client";

import React, { useState } from "react";
import {
  FolderKanban,
  FileText,
  Download,
  Search,
  ShieldCheck,
  Calendar,
  Lock,
  FileCheck,
} from "lucide-react";

interface DocItem {
  id: string;
  title: string;
  category: "DPDP Consent" | "Care Protocol" | "Clinical SOP" | "Operational Report";
  senior_id?: string;
  date: string;
  size: string;
}

const DOCS: DocItem[] = [
  {
    id: "DOC_001",
    title: "DPDP 2023 Guardian Authorization Record - Savitri Devi",
    category: "DPDP Consent",
    senior_id: "S0054",
    date: "12 Aug 2025",
    size: "245 KB",
  },
  {
    id: "DOC_002",
    title: "Emergency Fall & Fracture Escalation Standard Protocol v3.2",
    category: "Clinical SOP",
    date: "01 Aug 2025",
    size: "1.2 MB",
  },
  {
    id: "DOC_003",
    title: "DPDP 2023 Senior Consent Agreement - Kamala Sharma",
    category: "DPDP Consent",
    senior_id: "S0012",
    date: "20 Jul 2025",
    size: "210 KB",
  },
  {
    id: "DOC_004",
    title: "Monthly Field Caretaker Caseload Audit Report - July 2025",
    category: "Operational Report",
    date: "31 Jul 2025",
    size: "680 KB",
  },
  {
    id: "DOC_005",
    title: "AI Voice Companion Check-In Privacy & Encryption Policy",
    category: "Care Protocol",
    date: "15 Jul 2025",
    size: "390 KB",
  },
];

export default function CityManagerDocumentsPage() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");

  const filtered = DOCS.filter(
    (d) =>
      (!catFilter || d.category === catFilter) &&
      (d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.category.toLowerCase().includes(search.toLowerCase()) ||
        (d.senior_id && d.senior_id.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <FolderKanban className="w-6 h-6 text-[#1c3e35]" />
            <span>Documents &amp; DPDP Compliance Records</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Municipal consent records, care protocols, clinical SOPs, and compliance documentation.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents by title, senior ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {["", "DPDP Consent", "Clinical SOP", "Care Protocol", "Operational Report"].map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                catFilter === c
                  ? "bg-[#1c3e35] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {c || "All Categories"}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-5">Document Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Senior ID</th>
                <th className="py-3.5 px-4">Date Uploaded</th>
                <th className="py-3.5 px-4">Size</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-5 font-bold text-slate-900 flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>{doc.title}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {doc.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                    {doc.senior_id || "Chapter-wide"}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">{doc.date}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">{doc.size}</td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      onClick={() => alert(`Downloading ${doc.title}...`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold hover:text-slate-900 text-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Download</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

