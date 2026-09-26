import { redirect } from "next/navigation";

// Practice sets moved into the LMS page as a tab.
export default function AdminPracticeSetsPage() {
  redirect("/admin/lms?tab=practice");
}
