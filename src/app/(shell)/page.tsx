import MinimalHomeDashboard from "@/components/planner/MinimalHomeDashboard";

/**
 * Shell home route — renders `MinimalHomeDashboard` (pulse, hydration, movement,
 * morning routine). Writes require a signed-in Supabase user (`resolveSupabaseUserId`);
 * `daily_logs`, `activity_logs`, and `medication_logs` inserts include `user_id` when applicable.
 */
export default function PlannerHomePage() {
  // TEMP bypass: hide barometer pressure-drop advisory banner — remove prop when fixed
  return <MinimalHomeDashboard bypassBarometerAdvisory />;
}
