import { redirect } from "next/navigation";

// Projects now live on the Plan tab, under the visions they serve.
export default function ProjectsPage() {
  redirect("/plan");
}
