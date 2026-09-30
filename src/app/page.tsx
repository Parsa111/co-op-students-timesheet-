"use client";

import React, { useState, useEffect, useMemo } from "react";
import { TimesheetEntry } from "@/types/timesheet";
import { sampleTimesheetEntries } from "@/data/sampleData";
import {
  calculateHours,
  formatTime12h,
  formatDisplayDate,
  getTodayDateString,
  getCurrentTimeString,
} from "@/utils/timeUtils";
import { exportTimesheetToExcel } from "@/utils/exportExcel";
import { exportTimesheetToWord } from "@/utils/exportWord";
import {
  fetchTimesheets,
  insertTimesheet,
  updateTimesheet,
  deleteTimesheet,
  getSupabaseConfig,
  saveSupabaseConfig,
  isSupabaseConfigured,
} from "@/lib/supabase";
import {
  Clock,
  User,
  Calendar,
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  X,
  Search,
  RotateCcw,
  Database,
  Key,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import confetti from "canvas-confetti";

const STORAGE_KEY = "coop_simple_timesheet_entries_v2";

const SQL_SCHEMA_SNIPPET = `-- Run this in your Supabase SQL Editor:
create table if not exists timesheet_entries (
  id text primary key,
  name text not null,
  date text not null,
  time_in text not null,
  time_out text not null,
  total_hours numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table timesheet_entries enable row level security;

create policy "Allow all on timesheet_entries" 
  on timesheet_entries for all using (true) with check (true);`;

export default function TimesheetApp() {
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Form inputs
  const [name, setName] = useState<string>("Alex Rivera");
  const [date, setDate] = useState<string>("2026-09-30");
  const [timeIn, setTimeIn] = useState<string>("09:00");
  const [timeOut, setTimeOut] = useState<string>("17:00");

  // Filter / Search
  const [searchName, setSearchName] = useState<string>("");

  // Edit State
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);

  // Supabase states
  const [hasSupabase, setHasSupabase] = useState<boolean>(false);
  const [isDbLoading, setIsDbLoading] = useState<boolean>(false);
  const [isDbSaving, setIsDbSaving] = useState<boolean>(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [supabaseUrlInput, setSupabaseUrlInput] = useState<string>("");
  const [supabaseKeyInput, setSupabaseKeyInput] = useState<string>("");
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Notification Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Mount & load initial data
  useEffect(() => {
    setMounted(true);
    setDate(getTodayDateString());

    const config = getSupabaseConfig();
    setSupabaseUrlInput(config.url);
    setSupabaseKeyInput(config.anonKey);

    const configured = isSupabaseConfigured();
    setHasSupabase(configured);

    if (configured) {
      loadFromSupabase();
    } else {
      loadFromLocalStorage();
    }
  }, []);

  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setEntries(JSON.parse(saved));
      } else {
        setEntries(sampleTimesheetEntries);
      }
    } catch {
      setEntries(sampleTimesheetEntries);
    } finally {
      setIsLoaded(true);
    }
  };

  const loadFromSupabase = async () => {
    setIsDbLoading(true);
    try {
      const data = await fetchTimesheets();
      if (data && data.length > 0) {
        setEntries(data);
      } else {
        // Fall back to local or sample if empty table
        loadFromLocalStorage();
      }
    } catch (err) {
      console.warn("Could not load from Supabase table:", err);
      showToast("Could not load from Supabase. Falling back to local cache.");
      loadFromLocalStorage();
    } finally {
      setIsDbLoading(false);
      setIsLoaded(true);
    }
  };

  // 2. Backup to localStorage as offline safety
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  }, [entries, isLoaded]);

  // Current calculated preview hours
  const previewHours = useMemo(() => {
    return calculateHours(timeIn, timeOut);
  }, [timeIn, timeOut]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    if (!searchName.trim()) return entries;
    const query = searchName.toLowerCase();
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(query) ||
        e.date.includes(query)
    );
  }, [entries, searchName]);

  // Total hours of current list
  const totalHours = useMemo(() => {
    return filteredEntries.reduce((sum, e) => sum + e.totalHours, 0);
  }, [filteredEntries]);

  // Add shift (Saves to Supabase Database & updates UI)
  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Please enter the student's name");
      return;
    }

    const calculated = calculateHours(timeIn, timeOut);
    const newEntry: TimesheetEntry = {
      id: `shift-${Date.now()}`,
      name: name.trim(),
      date,
      timeIn,
      timeOut,
      totalHours: calculated,
      createdAt: new Date().toISOString(),
    };

    setIsDbSaving(true);
    try {
      if (hasSupabase) {
        await insertTimesheet(newEntry);
      }
      setEntries([newEntry, ...entries]);
      showToast(
        hasSupabase
          ? `Saved to Supabase! (${calculated.toFixed(2)} hrs)`
          : `Saved locally (${calculated.toFixed(2)} hrs)`
      );

      try {
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.5 } });
      } catch {}
    } catch (err) {
      console.error(err);
      // Still keep in local state so student work isn't lost
      setEntries([newEntry, ...entries]);
      showToast("Saved locally (Supabase write failed. Check table schema).");
    } finally {
      setIsDbSaving(false);
    }
  };

  // Delete shift
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shift?")) return;

    try {
      if (hasSupabase) {
        await deleteTimesheet(id);
      }
      setEntries(entries.filter((e) => e.id !== id));
      showToast("Shift deleted");
    } catch (err) {
      console.error(err);
      setEntries(entries.filter((e) => e.id !== id));
      showToast("Shift removed locally");
    }
  };

  // Edit shift save
  const handleUpdateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    const updatedHours = calculateHours(editingEntry.timeIn, editingEntry.timeOut);
    const updated = { ...editingEntry, totalHours: updatedHours };

    try {
      if (hasSupabase) {
        await updateTimesheet(updated);
      }
      setEntries(
        entries.map((item) => (item.id === updated.id ? updated : item))
      );
      setEditingEntry(null);
      showToast(
        hasSupabase ? "Updated in Supabase database" : "Shift updated successfully"
      );
    } catch (err) {
      console.error(err);
      setEntries(
        entries.map((item) => (item.id === updated.id ? updated : item))
      );
      setEditingEntry(null);
      showToast("Updated locally");
    }
  };

  // Save Supabase Credentials
  const handleSaveSupabaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrlInput.trim() || !supabaseKeyInput.trim()) {
      alert("Please enter both your Supabase URL and Anon Key.");
      return;
    }

    saveSupabaseConfig({
      url: supabaseUrlInput.trim(),
      anonKey: supabaseKeyInput.trim(),
    });

    setHasSupabase(true);
    setIsConfigModalOpen(false);
    showToast("Supabase credentials saved! Connecting...");
    loadFromSupabase();
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_SNIPPET);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
    showToast("SQL snippet copied to clipboard!");
  };

  // Export Excel
  const handleExportExcel = () => {
    exportTimesheetToExcel(filteredEntries, name);
    showToast("Downloaded Excel (.xlsx) file!");
  };

  // Export Word
  const handleExportWord = async () => {
    await exportTimesheetToWord(filteredEntries, name);
    showToast("Downloaded Word (.docx) file!");
  };

  // Reset to sample data
  const handleReset = () => {
    if (confirm("Reset to sample timesheet records?")) {
      setEntries(sampleTimesheetEntries);
      showToast("Reset to sample data");
    }
  };

  if (!mounted) {
    return (
      <div suppressHydrationWarning className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div suppressHydrationWarning className="text-slate-400 text-sm">
          Loading Co-op Timesheet...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-semibold">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toast}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900">
                  Co-op Timesheet
                </h1>
                {/* Supabase Status Pill */}
                <button
                  onClick={() => setIsConfigModalOpen(true)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold transition-all border ${
                    hasSupabase
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                      : "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                  }`}
                  title="Click to configure Supabase database"
                >
                  <Database className="w-3 h-3" />
                  <span>{hasSupabase ? "Supabase Active" : "Connect Supabase"}</span>
                </button>
              </div>
              <p className="text-xs text-slate-500">Record Name & Time at Work</p>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-all active:scale-95"
              title="Download as Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span className="hidden xs:inline">Excel (.xlsx)</span>
              <span className="xs:hidden">Excel</span>
            </button>

            <button
              onClick={handleExportWord}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold text-blue-800 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-xl transition-all active:scale-95"
              title="Download as Word"
            >
              <FileText className="w-4 h-4 text-blue-700" />
              <span className="hidden xs:inline">Word (.docx)</span>
              <span className="xs:hidden">Word</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 py-5 sm:py-6 space-y-5">
        {/* Supabase Notice Banner if not configured yet */}
        {!hasSupabase && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm text-amber-900">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <strong>Connect your Supabase Database:</strong> Shifts are currently
                stored locally. Connect your Supabase project so timesheets save to
                the cloud!
              </div>
            </div>
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors shrink-0"
            >
              Connect Supabase
            </button>
          </div>
        )}

        {/* Record Shift Form Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
          <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            <span>Record Name & Time</span>
            {isDbSaving && (
              <span className="text-xs text-blue-600 font-normal flex items-center gap-1 ml-auto">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving to Supabase...
              </span>
            )}
          </h2>

          <form onSubmit={handleAddShift} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter student name"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600 font-medium"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Date</label>
                  <button
                    type="button"
                    onClick={() => setDate(getTodayDateString())}
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    Today
                  </button>
                </div>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Time In */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Time In</label>
                  <button
                    type="button"
                    onClick={() => setTimeIn(getCurrentTimeString())}
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    Current
                  </button>
                </div>
                <input
                  type="time"
                  required
                  value={timeIn}
                  onChange={(e) => setTimeIn(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600"
                />
              </div>

              {/* Time Out */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Time Out</label>
                  <button
                    type="button"
                    onClick={() => setTimeOut(getCurrentTimeString())}
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    Current
                  </button>
                </div>
                <input
                  type="time"
                  required
                  value={timeOut}
                  onChange={(e) => setTimeOut(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600"
                />
              </div>
            </div>

            {/* Bottom Row of Form: Total Preview & Submit */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="text-xs sm:text-sm text-slate-600">
                Calculated Shift Hours:{" "}
                <strong className="text-blue-700 font-extrabold text-base">
                  {previewHours.toFixed(2)} hrs
                </strong>
                <span className="text-slate-400 text-xs ml-1.5">
                  ({formatTime12h(timeIn)} to {formatTime12h(timeOut)})
                </span>
              </div>

              <button
                type="submit"
                disabled={isDbSaving}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all active:scale-95"
              >
                {isDbSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Save to Database</span>
              </button>
            </div>
          </form>
        </div>

        {/* Timesheet Table & Summary */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Logged Shifts ({filteredEntries.length})</span>
                {isDbLoading && (
                  <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                )}
              </h3>
              <p className="text-xs text-slate-500">
                Total Work Hours:{" "}
                <span className="font-extrabold text-blue-600 text-sm">
                  {totalHours.toFixed(2)} hrs
                </span>
                {hasSupabase && (
                  <span className="text-emerald-600 ml-2 font-medium">
                    • Synced with Supabase
                  </span>
                )}
              </p>
            </div>

            {/* Search Filter */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search by name or date..."
                className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600"
              />
              {searchName && (
                <button
                  onClick={() => setSearchName("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Mobile Card View (screens < 640px) */}
          <div className="sm:hidden divide-y divide-slate-100">
            {filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No shifts found. Record a shift above!
              </div>
            ) : (
              filteredEntries.map((entry, index) => (
                <div key={entry.id} className="p-4 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 shrink-0 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500">
                        {index + 1}
                      </span>
                      <div className="font-bold text-slate-900 text-sm">
                        {entry.name}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatDisplayDate(entry.date)}
                    </div>
                    <div className="text-xs text-slate-600 mt-1 font-medium">
                      {formatTime12h(entry.timeIn)} – {formatTime12h(entry.timeOut)}
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-2">
                    <span className="font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg text-xs">
                      {entry.totalHours.toFixed(2)} hrs
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingEntry(entry)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (screens >= 640px) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-10">#</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Time In</th>
                  <th className="py-3 px-4">Time Out</th>
                  <th className="py-3 px-4">Total Hours</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                      No timesheet entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry, index) => (
                    <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-400 font-semibold tabular-nums">
                        {index + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {entry.name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatDisplayDate(entry.date)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {formatTime12h(entry.timeIn)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {formatTime12h(entry.timeOut)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md text-xs">
                          {entry.totalHours.toFixed(2)}h
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingEntry(entry)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredEntries.length > 0 && (
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="py-3 px-4 text-right text-slate-700">
                      TOTAL HOURS:
                    </td>
                    <td className="py-3 px-4 text-blue-700 font-extrabold text-sm">
                      {totalHours.toFixed(2)} hrs
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Footer info & sample data reset */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
          <span>
            {hasSupabase
              ? "All timesheet records are saved in your Supabase database."
              : "Saved locally. Connect Supabase above to sync to cloud."}
          </span>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 hover:text-slate-800 underline transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to Sample Data
          </button>
        </div>
      </main>

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">Edit Shift</h3>
              <button
                onClick={() => setEditingEntry(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateShift} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={editingEntry.name}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, name: e.target.value })
                  }
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={editingEntry.date}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, date: e.target.value })
                  }
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time In
                  </label>
                  <input
                    type="time"
                    required
                    value={editingEntry.timeIn}
                    onChange={(e) =>
                      setEditingEntry({ ...editingEntry, timeIn: e.target.value })
                    }
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time Out
                  </label>
                  <input
                    type="time"
                    required
                    value={editingEntry.timeOut}
                    onChange={(e) =>
                      setEditingEntry({ ...editingEntry, timeOut: e.target.value })
                    }
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-2 text-xs text-slate-600 font-medium">
                New Calculated Hours:{" "}
                <strong className="text-blue-700 font-bold">
                  {calculateHours(editingEntry.timeIn, editingEntry.timeOut).toFixed(2)} hrs
                </strong>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supabase Database Connection Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Connect to Supabase
                  </h3>
                  <p className="text-xs text-slate-500">
                    Saves student shifts to your Supabase PostgreSQL database
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick SQL instruction */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between font-semibold text-slate-700">
                <span>1. Run this table creation SQL in Supabase:</span>
                <button
                  type="button"
                  onClick={copySqlToClipboard}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-bold"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy SQL
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-200 p-2.5 rounded-lg text-[10px] overflow-x-auto font-mono max-h-24">
                {SQL_SCHEMA_SNIPPET}
              </pre>
            </div>

            <form onSubmit={handleSaveSupabaseConfig} className="space-y-3">
              <div className="font-semibold text-xs text-slate-700">
                2. Enter your Project Credentials (from Project Settings &gt; API):
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrlInput}
                  onChange={(e) => setSupabaseUrlInput(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Anon / Public Key
                </label>
                <input
                  type="password"
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseKeyInput}
                  onChange={(e) => setSupabaseKeyInput(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-600 font-mono"
                />
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Open Supabase Dashboard</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(false)}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
                  >
                    Connect & Sync
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
