/**
 * Catalog skill slug -> slugs that are *partially* implied when it is clearly
 * demonstrated. Used only to grant capped, lower-confidence credit to a related
 * skill that has no stronger direct evidence (e.g. demonstrated PostgreSQL
 * should not leave SQL at zero). It never grants a "strong" classification.
 */
export const SKILL_IMPLIES: Record<string, string[]> = {
  nextjs: ["react", "javascript", "html-css"],
  react: ["javascript", "html-css"],
  "react-native": ["react", "javascript", "mobile-ux"],
  tailwind: ["html-css"],
  typescript: ["javascript"],
  express: ["nodejs", "rest-apis", "javascript"],
  nodejs: ["javascript"],
  graphql: ["rest-apis", "data-modeling"],
  postgresql: ["sql", "data-modeling"],
  mysql: ["sql", "data-modeling"],
  mongodb: ["data-modeling"],
  redis: ["data-modeling"],
  "sql-optimization": ["sql"],
  "data-warehousing": ["sql", "data-modeling"],
  kubernetes: ["docker", "linux"],
  docker: ["linux"],
  terraform: ["cloud", "aws"],
  aws: ["cloud", "linux"],
  cloud: ["linux"],
  cicd: ["git"],
  observability: ["linux"],
  pandas: ["python"],
  "machine-learning": ["python", "statistics"],
  "data-visualization": ["statistics"],
  "system-design": ["rest-apis", "data-modeling"],
  "design-systems": ["figma", "html-css"],
  "interaction-design": ["figma"],
};

/** slug helpers — catalog ids are `skill-<slug>` */
export function slugFromId(skillId: string) {
  return skillId.replace(/^skill-/, "");
}

export function impliedSkillIds(skillId: string): string[] {
  return (SKILL_IMPLIES[slugFromId(skillId)] ?? []).map((slug) => `skill-${slug}`);
}
