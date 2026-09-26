import { redirect } from "next/navigation";

// Practice now lives as a tab on the unified Learn page.
export default function PracticePage() {
  redirect("/courses?tab=practice");
}
