"use client";

import { useState } from "react";
import { GraduationCap, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { CourseManager } from "@/components/admin/course-manager";
import { QuestionSetManager } from "@/components/admin/question-set-manager";

type SkillOption = { id: string; name: string; skillType: string };

export function LmsWorkspace({
  courses,
  skills,
  questionSets,
  initialTab,
}: {
  courses: Record<string, unknown>[];
  skills: SkillOption[];
  questionSets: Record<string, unknown>[];
  initialTab?: string;
}) {
  const [tab, setTab] = useState<"courses" | "practice">(initialTab === "practice" ? "practice" : "courses");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">LMS</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Courses and practice question sets — both authored with Gemini, no manual typing needed.</p>
      </div>

      <div className="inline-flex rounded-[10px] border bg-[var(--surface)] p-1">
        {([
          ["courses", "Courses", GraduationCap],
          ["practice", "Practice sets", ListChecks],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition",
              tab === key ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]" : "text-[var(--muted-strong)] hover:bg-[var(--surface-muted)]",
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === "courses" ? (
        <CourseManager initialCourses={courses} skills={skills} embedded />
      ) : (
        <QuestionSetManager initial={questionSets} embedded />
      )}
    </div>
  );
}
