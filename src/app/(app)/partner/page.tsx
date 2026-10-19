import { redirect } from "next/navigation";

// The partner lives in the Context tab.
export default function PartnerPage() {
  redirect("/context");
}
