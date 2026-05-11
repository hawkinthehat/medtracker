import MinimalHomeDashboard from "@/components/planner/MinimalHomeDashboard";

/**
 * Shell home route — renders `MinimalHomeDashboard` (pulse, hydration, movement,
 * morning routine). Data writes use `getSupabaseBrowserClient()` + RLS; inserts
 * attach `user_id` where the table requires it (`activity_logs` via
 * `insertActivityLogRow`; `daily_logs` has no user column in current migrations).
 */
export default function PlannerHomePage() {
  // TEMP bypass: hide barometer pressure-drop advisory banner — remove prop when fixed
  return <MinimalHomeDashboard bypassBarometerAdvisory />;
}
