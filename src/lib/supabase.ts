import { createClient } from "@supabase/supabase-js";
import { TimesheetEntry } from "@/types/timesheet";
import { calculateHours } from "@/utils/timeUtils";

// Standard environment variables with your project credentials as default
const ENV_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://xhghejsrsfcoppqzvflo.supabase.co";
const ENV_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZ2hlanNyc2Zjb3BwcXp2ZmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzYwNjEsImV4cCI6MjEwNjM1MjA2MX0.rU8THq_N1inJo07nv4644z_5rML3Axo3tnfTPSkd7Wg";

const STORAGE_SUPABASE_CONFIG_KEY = "coop_supabase_config";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Returns current Supabase config from env or localStorage
 */
export function getSupabaseConfig(): SupabaseConfig {
  if (ENV_SUPABASE_URL && ENV_SUPABASE_ANON_KEY) {
    return { url: ENV_SUPABASE_URL, anonKey: ENV_SUPABASE_ANON_KEY };
  }

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_SUPABASE_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.anonKey) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  return { url: "", anonKey: "" };
}

/**
 * Saves Supabase config in localStorage (useful if user doesn't use .env.local)
 */
export function saveSupabaseConfig(config: SupabaseConfig) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_SUPABASE_CONFIG_KEY, JSON.stringify(config));
  }
}

/**
 * Checks if Supabase credentials are provided
 */
export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

/**
 * Creates Supabase client instance
 */
export function getSupabaseClient() {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }
  return createClient(config.url, config.anonKey);
}

/**
 * Fetches all timesheet records from Supabase
 */
export async function fetchTimesheets(): Promise<TimesheetEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("timesheet_entries")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching timesheets from Supabase:", error);
    throw error;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    date: row.date,
    timeIn: row.time_in,
    timeOut: row.time_out,
    totalHours: calculateHours(row.time_in, row.time_out),
    createdAt: row.created_at,
  }));
}

/**
 * Inserts a timesheet entry into Supabase
 */
export async function insertTimesheet(entry: TimesheetEntry): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from("timesheet_entries").insert([
    {
      id: entry.id,
      name: entry.name,
      date: entry.date,
      time_in: entry.timeIn,
      time_out: entry.timeOut,
      total_hours: entry.totalHours,
      created_at: entry.createdAt || new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error("Error inserting timesheet to Supabase:", error);
    throw error;
  }
}

/**
 * Updates a timesheet entry in Supabase
 */
export async function updateTimesheet(entry: TimesheetEntry): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("timesheet_entries")
    .update({
      name: entry.name,
      date: entry.date,
      time_in: entry.timeIn,
      time_out: entry.timeOut,
      total_hours: entry.totalHours,
    })
    .eq("id", entry.id);

  if (error) {
    console.error("Error updating timesheet in Supabase:", error);
    throw error;
  }
}

/**
 * Deletes a timesheet entry from Supabase
 */
export async function deleteTimesheet(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("timesheet_entries")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting timesheet from Supabase:", error);
    throw error;
  }
}
