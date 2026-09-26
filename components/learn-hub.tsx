"use client";

import { useState } from "react";
import { Dumbbell, LibraryBig } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoursesView } from "@/components/courses-view";
import { PracticeBoard } from "@/components/practice-board";
import { QuizSets } from "@/components/quiz-sets";

export function LearnHub({
  courses,
  practice,
  quizSets,
  initialTab,
}: {
  courses: { recommended: never[]; enrolled: never[] };
  practice: { sessions: never[]; suggestions: never[] };
  quizSets: never[];
  initialTab?: string;
}) {
  const [tab, setTab] = useState<"courses" | "practice">(initialTab === "practice" ? "practice" : "courses");

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-8 lg:px-10 lg:py-10">
      <div role="tablist" aria-label="Learn sections" className="mb-6 inline-flex rounded-[10px] border bg-[var(--surface)] p-1">
        {([
          ["courses", "Courses", LibraryBig],
          ["practice", "Practice", Dumbbell],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`learn-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`learn-panel-${key}`}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-[8px] px-4 py-1.5 text-[13px] font-medium transition",
              tab === key ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]" : "text-[var(--muted-strong)] hover:bg-[var(--surface-muted)]",
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === "courses" ? (
        <div role="tabpanel" id="learn-panel-courses" aria-labelledby="learn-tab-courses">
          <CoursesView initial={courses} />
        </div>
      ) : (
        <div role="tabpanel" id="learn-panel-practice" aria-labelledby="learn-tab-practice">
          <PracticeBoard initial={practice} />
          <QuizSets initial={quizSets} />
        </div>
      )}
    </div>
  );
}
