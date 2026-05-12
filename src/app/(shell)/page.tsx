import MinimalHomeDashboard from "@/components/planner/MinimalHomeDashboard";

/**
 * Shell home route — renders `MinimalHomeDashboard` (pulse, hydration, movement,
 * morning routine). When Supabase is configured, the planner requires a valid
 * `auth.getUser()` session (see `useDashboardSession`); `daily_logs` / `activity_logs`
 * / `medication_logs` writes resolve `user_id` via `auth.getUser()` at save time.
 */
export default function PlannerHomePage() {
  // TEMP bypass: hide barometer pressure-drop advisory banner — remove prop when fixed
  return <MinimalHomeDashboard bypassBarometerAdvisory />;
}
