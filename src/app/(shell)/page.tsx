import MinimalHomeDashboard from "@/components/planner/MinimalHomeDashboard";

/** Minimal high-contrast home: pulse, hydration, crisis sketch, due meds. */
export default function PlannerHomePage() {
  // TEMP bypass: hide barometer pressure-drop advisory banner — remove prop when fixed
  return <MinimalHomeDashboard bypassBarometerAdvisory />;
}
