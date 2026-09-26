import { describe, expect, it } from "vitest";
import { calculateScore, classifySkill, inferSkill, inferSoftSkill } from "@/lib/analyzer";
import { impliedSkillIds } from "@/lib/skill-graph";

describe("Aperio analyzer", () => {
  it("captures evidence and a working level from applied resume language", () => {
    const result = inferSkill("Built and deployed a React dashboard with REST APIs.", ["react", "react.js"]);
    expect(result.level).toBe(2);
    expect(result.evidence[0]).toContain("React");
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it("credits a soft skill only from behavioural evidence and reads leadership language", () => {
    const none = inferSoftSkill("Proficient in Python and SQL.", ["leadership", "led"]);
    expect(none.level).toBe(0);
    expect(none.evidence).toHaveLength(0);

    const led = inferSoftSkill("Led a team of four engineers and mentored two juniors to promotion.", ["leadership", "led", "mentored"]);
    expect(led.level).toBeGreaterThanOrEqual(3);
    expect(led.evidence[0]).toContain("Led");
  });

  it("uses constructive classifications", () => {
    expect(classifySkill(3, 3)).toBe("strong");
    expect(classifySkill(1, 3)).toBe("developing");
    expect(classifySkill(0, 3)).toBe("missing");
  });

  it("calculates a weighted normalized score", () => {
    expect(calculateScore([{ currentLevel: 3, targetLevel: 3, weight: 10 }, { currentLevel: 0, targetLevel: 3, weight: 10 }])).toBe(50);
  });

  it("reads a listed skills inventory as at least a working level", () => {
    const result = inferSkill("Backend & Data: Node.js, REST APIs, PostgreSQL, Neon, authentication & data modeling", ["postgresql", "postgres"]);
    expect(result.level).toBeGreaterThanOrEqual(2);
    expect(result.evidence[0]).toContain("PostgreSQL");
  });

  it("propagates related-skill credit through the skill graph", () => {
    expect(impliedSkillIds("skill-postgresql")).toContain("skill-sql");
    expect(impliedSkillIds("skill-nextjs")).toEqual(expect.arrayContaining(["skill-react", "skill-javascript"]));
    expect(impliedSkillIds("skill-unknown-thing")).toEqual([]);
  });
});
