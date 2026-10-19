import { redirect } from "next/navigation";

// Plan was split into the Visions and Projects tabs.
export default function PlanPage() {
  redirect("/projects");
}
