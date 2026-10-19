import { redirect } from "next/navigation";

// Visions now live on the Plan tab, with the projects that serve them.
export default function VisionsPage() {
  redirect("/plan");
}
