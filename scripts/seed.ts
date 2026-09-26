import { neon } from "@neondatabase/serverless";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = neon(url);

const skills = [
  ["javascript", "JavaScript", "Languages", "Builds interactive web and server applications.", ["javascript", "js", "ecmascript"]],
  ["typescript", "TypeScript", "Languages", "Adds static typing and safer interfaces to JavaScript systems.", ["typescript", "ts"]],
  ["python", "Python", "Languages", "Supports data, automation, backend, and machine learning work.", ["python"]],
  ["java", "Java", "Languages", "Powers strongly typed enterprise and backend systems.", ["java", "spring boot"]],
  ["html-css", "HTML/CSS", "Frontend", "Creates accessible structure and responsive visual presentation.", ["html", "css", "scss", "sass"]],
  ["react", "React", "Frontend", "Builds component-based user interfaces and application state flows.", ["react", "react.js", "reactjs"]],
  ["nextjs", "Next.js", "Frontend", "Delivers production React applications with server rendering and routing.", ["next.js", "nextjs", "next js"]],
  ["tailwind", "Tailwind CSS", "Frontend", "Enables systematic utility-first interface styling.", ["tailwind", "tailwind css"]],
  ["accessibility", "Accessibility", "Frontend", "Makes products usable with keyboards, assistive technology, and diverse needs.", ["accessibility", "wcag", "aria", "a11y"]],
  ["nodejs", "Node.js", "Backend", "Runs JavaScript services, APIs, and background workloads.", ["node.js", "nodejs", "node js"]],
  ["express", "Express", "Backend", "Provides a lightweight HTTP service framework for Node.js.", ["express", "express.js", "expressjs"]],
  ["rest-apis", "REST APIs", "Backend", "Defines interoperable HTTP interfaces and resource contracts.", ["rest api", "rest apis", "restful", "rest services", "api development", "apis", "backend api", "web api", "http api"]],
  ["graphql", "GraphQL", "Backend", "Enables typed, client-directed API queries and schemas.", ["graphql", "apollo server"]],
  ["authentication", "Authentication", "Backend", "Protects identity, sessions, and application access.", ["authentication", "authorization", "oauth", "jwt", "rbac"]],
  ["postgresql", "PostgreSQL", "Database", "Provides durable relational data, indexing, and transactions.", ["postgresql", "postgres", "psql"]],
  ["sql", "SQL", "Database", "Queries, models, and transforms relational data.", ["sql", "database queries"]],
  ["mongodb", "MongoDB", "Database", "Stores flexible document-oriented application data.", ["mongodb", "mongo db"]],
  ["redis", "Redis", "Database", "Supports caching, queues, and low-latency state.", ["redis"]],
  ["data-modeling", "Data Modeling", "Database", "Designs reliable schemas and information relationships.", ["data modeling", "schema design", "database design"]],
  ["sql-optimization", "SQL Optimization", "Database", "Improves query performance using plans, indexes, and schema choices.", ["query optimization", "sql optimization", "database indexing", "explain analyze"]],
  ["git", "Git", "Engineering Practices", "Provides traceable version control and collaborative change management.", ["git", "github", "gitlab", "version control"]],
  ["testing", "Automated Testing", "Engineering Practices", "Protects behavior through repeatable unit, integration, and end-to-end checks.", ["unit testing", "integration testing", "automated testing", "jest", "vitest", "pytest", "cypress", "playwright"]],
  ["system-design", "System Design", "Engineering Practices", "Shapes reliable components, boundaries, and scaling decisions.", ["system design", "distributed systems", "architecture design", "software architecture", "application architecture", "system architecture", "architected", "technical design", "designed the architecture", "end-to-end architecture", "scalable architecture", "high-level design"]],
  ["code-review", "Code Review", "Engineering Practices", "Raises quality through structured peer feedback.", ["code review", "pull request review", "peer review"]],
  ["agile", "Agile Delivery", "Engineering Practices", "Coordinates incremental product delivery and team learning.", ["agile", "scrum", "kanban", "sprint planning"]],
  ["docker", "Docker", "DevOps", "Packages applications into consistent, portable runtime environments.", ["docker", "containerization", "containers"]],
  ["cicd", "CI/CD", "DevOps", "Automates validation and reliable software delivery.", ["ci/cd", "continuous integration", "continuous delivery", "github actions", "jenkins"]],
  ["kubernetes", "Kubernetes", "DevOps", "Orchestrates containerized services across production infrastructure.", ["kubernetes", "k8s"]],
  ["aws", "AWS", "Cloud", "Provides managed infrastructure, compute, storage, and platform services.", ["aws", "amazon web services", "ec2", "lambda", "s3"]],
  ["cloud", "Cloud Architecture", "Cloud", "Designs secure, resilient workloads on managed infrastructure.", ["cloud architecture", "cloud infrastructure", "azure", "gcp"]],
  ["observability", "Observability", "DevOps", "Makes production systems understandable through logs, metrics, and traces.", ["observability", "monitoring", "logging", "metrics", "tracing", "grafana", "datadog"]],
  ["linux", "Linux", "DevOps", "Supports server operations, automation, and runtime diagnosis.", ["linux", "unix", "bash", "shell scripting"]],
  ["terraform", "Terraform", "DevOps", "Defines repeatable cloud infrastructure as code.", ["terraform", "infrastructure as code", "iac"]],
  ["pandas", "Pandas", "Data", "Transforms and analyzes tabular data in Python.", ["pandas"]],
  ["statistics", "Statistics", "Data", "Supports sound inference, experimentation, and quantitative decisions.", ["statistics", "statistical analysis", "hypothesis testing"]],
  ["machine-learning", "Machine Learning", "Data", "Builds predictive systems from data and evaluated models.", ["machine learning", "scikit-learn", "tensorflow", "pytorch"]],
  ["data-visualization", "Data Visualization", "Data", "Communicates quantitative patterns with clear visual encodings.", ["data visualization", "tableau", "power bi", "matplotlib", "seaborn"]],
  ["data-warehousing", "Data Warehousing", "Data", "Organizes analytical data for reliable reporting and decisions.", ["data warehouse", "snowflake", "bigquery", "redshift"]],
  ["figma", "Figma", "Design", "Supports collaborative interface design and prototyping.", ["figma", "figjam"]],
  ["user-research", "User Research", "Design", "Builds product understanding from observed user needs and behavior.", ["user research", "user interviews", "usability testing"]],
  ["interaction-design", "Interaction Design", "Design", "Creates coherent flows, states, and responsive behavior.", ["interaction design", "wireframes", "prototyping", "ux design"]],
  ["design-systems", "Design Systems", "Design", "Creates reusable patterns, tokens, and product consistency.", ["design system", "design tokens", "component library"]],
  ["react-native", "React Native", "Mobile", "Builds cross-platform native mobile applications using React.", ["react native", "react-native", "expo"]],
  ["mobile-ux", "Mobile UX", "Mobile", "Designs touch-first flows across device constraints.", ["mobile ux", "responsive mobile", "mobile design"]],
  ["security", "Application Security", "Security", "Reduces risk through secure design, testing, and operations.", ["application security", "owasp", "security testing", "vulnerability assessment"]],
  ["networking", "Networking", "Security", "Explains protocols, traffic, connectivity, and network controls.", ["networking", "tcp/ip", "dns", "firewalls"]],
  ["incident-response", "Incident Response", "Security", "Coordinates detection, containment, recovery, and learning from security events.", ["incident response", "soc", "siem", "threat detection"]],
] as const;

// Soft / professional skills. Aliases double as the behavioural phrases the
// analyzer looks for as evidence in a resume or profile.
const softSkills = [
  ["communication", "Communication", "Professional Skills", "Explains ideas, decisions, and trade-offs clearly to technical and non-technical audiences.", ["communication", "communicated", "presented", "presentation", "wrote documentation", "articulated", "explained", "public speaking", "technical writing"]],
  ["collaboration", "Collaboration", "Professional Skills", "Works effectively across roles and teams toward a shared outcome.", ["collaboration", "collaborated", "cross-functional", "cross functional", "partnered with", "worked closely with", "paired with", "team player", "co-ordinated with"]],
  ["problem-solving", "Problem Solving", "Professional Skills", "Breaks ambiguous problems into workable steps and reaches sound decisions.", ["problem solving", "problem-solving", "root cause", "root-caused", "troubleshot", "debugged", "diagnosed", "resolved", "automated", "automation", "optimized", "analysed the issue", "analyzed the issue"]],
  ["adaptability", "Adaptability", "Professional Skills", "Adjusts quickly to changing priorities, tools, and constraints.", ["adaptability", "adapted", "learned quickly", "picked up", "self-taught", "wore multiple hats", "shifting priorities", "fast-paced", "fast-moving", "ambiguity", "pivoted"]],
  ["ownership", "Ownership & Accountability", "Professional Skills", "Takes end-to-end responsibility for outcomes, not just assigned tasks.", ["ownership", "owned", "end-to-end", "took responsibility", "accountable for", "drove", "delivered", "shipped", "saw it through", "founder", "founded"]],
  ["leadership", "Leadership", "Professional Skills", "Guides direction, sets standards, and enables others to do their best work.", ["leadership", "led", "led a team", "managed a team", "line-managed", "set the direction", "headed", "spearheaded", "chaired", "founder", "co-founder", "founded", "tech lead", "team lead", "product owner"]],
  ["stakeholder-management", "Stakeholder Management", "Professional Skills", "Aligns expectations and communicates progress with clients, partners, and leadership.", ["stakeholder", "stakeholders", "client-facing", "customer-facing", "liaised", "reported to leadership", "managed expectations", "requirements gathering"]],
  ["mentoring", "Mentoring & Coaching", "Professional Skills", "Grows other people's skills through feedback, pairing, and structured guidance.", ["mentoring", "mentored", "coached", "onboarded", "trained", "gave feedback", "code review feedback", "taught"]],
  ["critical-thinking", "Critical Thinking", "Professional Skills", "Weighs evidence and trade-offs before committing to a course of action.", ["critical thinking", "evaluated trade-offs", "weighed options", "assessed risk", "data-informed", "evidence-based decision", "prioritised based on"]],
  ["time-management", "Time Management", "Professional Skills", "Plans, sequences, and delivers work against deadlines with limited supervision.", ["time management", "prioritised", "prioritized", "met deadlines", "managed competing", "planned the sprint", "estimated", "delivered on schedule"]],
] as const;

const roles = [
  ["full-stack-developer", "Full Stack Developer", "Builds complete web products across frontend, backend, data, and delivery.", "Engineering"],
  ["frontend-developer", "Frontend Developer", "Creates accessible, responsive, and maintainable web experiences.", "Engineering"],
  ["backend-developer", "Backend Developer", "Designs APIs, data models, services, and reliable backend systems.", "Engineering"],
  ["data-scientist", "Data Scientist", "Uses statistics, code, and machine learning to solve data problems.", "Data"],
  ["data-analyst", "Data Analyst", "Turns business data into trustworthy analysis and decisions.", "Data"],
  ["devops-engineer", "DevOps Engineer", "Automates infrastructure, delivery, reliability, and production operations.", "Infrastructure"],
  ["cloud-engineer", "Cloud Engineer", "Builds secure, scalable infrastructure on cloud platforms.", "Infrastructure"],
  ["cybersecurity-analyst", "Cybersecurity Analyst", "Monitors risk, investigates threats, and strengthens security posture.", "Security"],
  ["product-designer", "Product Designer", "Combines research, interaction design, and systems thinking to shape digital products.", "Design"],
  ["mobile-developer", "Mobile Developer", "Builds reliable, user-centered mobile applications and services.", "Engineering"],
] as const;

type Importance = "critical" | "high" | "medium" | "optional";
type Requirement = [string, Importance, number];
const requirements: Record<string, Requirement[]> = {
  "full-stack-developer": [["javascript","critical",10],["typescript","high",8],["react","critical",10],["html-css","high",7],["nodejs","critical",10],["rest-apis","critical",9],["postgresql","high",8],["git","high",6],["testing","high",8],["docker","high",7],["cicd","medium",5],["system-design","high",8],["authentication","high",7],["observability","medium",5],["sql-optimization","medium",5]],
  "frontend-developer": [["javascript","critical",10],["typescript","high",9],["react","critical",10],["html-css","critical",9],["nextjs","high",8],["accessibility","high",8],["testing","high",8],["git","high",6],["rest-apis","medium",6],["design-systems","medium",5],["cicd","medium",4],["performance","optional",3]].filter(([slug]) => slug !== "performance") as Requirement[],
  "backend-developer": [["nodejs","critical",10],["typescript","high",8],["rest-apis","critical",10],["postgresql","critical",9],["sql","high",8],["data-modeling","high",8],["authentication","high",8],["testing","high",8],["docker","high",7],["system-design","critical",9],["redis","medium",5],["cicd","medium",5],["observability","high",7]],
  "data-scientist": [["python","critical",10],["sql","high",8],["pandas","high",8],["statistics","critical",10],["machine-learning","critical",10],["data-visualization","high",7],["git","medium",5],["data-warehousing","medium",5],["testing","medium",4],["cloud","medium",4]],
  "data-analyst": [["sql","critical",10],["statistics","high",8],["data-visualization","critical",9],["pandas","high",7],["data-warehousing","high",7],["python","medium",6],["data-modeling","medium",5],["git","optional",3]],
  "devops-engineer": [["linux","critical",10],["docker","critical",10],["cicd","critical",10],["kubernetes","high",8],["aws","high",8],["terraform","high",8],["observability","critical",9],["networking","high",7],["security","high",7],["git","high",6],["system-design","medium",5]],
  "cloud-engineer": [["cloud","critical",10],["aws","critical",10],["terraform","critical",9],["linux","high",8],["networking","high",8],["docker","high",7],["kubernetes","high",7],["security","high",8],["observability","high",7],["cicd","medium",5]],
  "cybersecurity-analyst": [["security","critical",10],["networking","critical",9],["incident-response","critical",10],["linux","high",8],["cloud","high",7],["observability","high",7],["authentication","high",7],["python","medium",5],["sql","medium",4]],
  "product-designer": [["figma","critical",10],["user-research","critical",10],["interaction-design","critical",10],["design-systems","high",8],["accessibility","high",8],["mobile-ux","medium",6],["html-css","optional",3],["agile","medium",4]],
  "mobile-developer": [["javascript","high",8],["typescript","critical",9],["react-native","critical",10],["mobile-ux","high",8],["rest-apis","high",8],["testing","high",8],["git","high",6],["authentication","high",7],["cicd","medium",5],["observability","medium",5]],
};

// Applied to every role. Target level still scales with seniority through the
// junior/mid/senior offset below, so "leadership" is target 1 for a junior and
// target 3 for a senior.
// Soft skills carry deliberately lighter weight than technical requirements:
// a résumé rarely states them explicitly, so they inform the picture without
// dominating the score. They surface as a separate "professional readiness"
// number in the report.
const softRequirements: Requirement[] = [
  ["problem-solving", "high", 5],
  ["communication", "medium", 4],
  ["collaboration", "medium", 4],
  ["ownership", "medium", 3],
  ["adaptability", "medium", 3],
  ["critical-thinking", "medium", 3],
  ["time-management", "medium", 2],
  ["stakeholder-management", "medium", 2],
  ["leadership", "optional", 2],
  ["mentoring", "optional", 2],
];

// Neon's HTTP driver does one request per query; the serverless pooler will
// occasionally drop a long run of them. Retry transient failures, and batch the
// bulk inserts into a handful of multi-row statements.
async function run(text: string, params: unknown[]) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await sql.query(text, params);
    } catch (error) {
      const code = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
      const transient = code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EPIPE" || code === "UND_ERR_SOCKET";
      if (!transient || attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
}

function placeholders(rows: number, cols: number) {
  return Array.from({ length: rows }, (_, r) => `(${Array.from({ length: cols }, (_, c) => `$${r * cols + c + 1}`).join(",")})`).join(",");
}

async function main() {
  const allSkills = [
    ...skills.map(([slug, name, category, description, aliases]) => ({ slug, name, category, description, aliases, type: "technical" as const })),
    ...softSkills.map(([slug, name, category, description, aliases]) => ({ slug, name, category, description, aliases, type: "soft" as const })),
  ];
  const skillParams = allSkills.flatMap((s) => [`skill-${s.slug}`, s.slug, s.name, s.category, s.description, s.aliases, s.type]);
  await run(
    `INSERT INTO skills (id, slug, name, category, description, aliases, skill_type)
     VALUES ${placeholders(allSkills.length, 7)}
     ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, description=EXCLUDED.description,
       aliases=EXCLUDED.aliases, skill_type=EXCLUDED.skill_type, updated_at=now()`,
    skillParams,
  );

  const roleParams = roles.flatMap(([slug, title, description, category]) => [`role-${slug}`, slug, title, description, category]);
  await run(
    `INSERT INTO roles (id, slug, title, description, category)
     VALUES ${placeholders(roles.length, 5)}
     ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, category=EXCLUDED.category, updated_at=now()`,
    roleParams,
  );

  for (const [slug] of roles) {
    const rows: unknown[][] = [];
    for (const [skillSlug, importance, weight] of [...requirements[slug], ...softRequirements]) {
      for (const [level, targetOffset] of [["junior", -1], ["mid", 0], ["senior", 1]] as const) {
        const midTarget = importance === "critical" ? 3 : importance === "high" ? 2 : 2;
        const target = Math.max(1, Math.min(4, midTarget + targetOffset));
        rows.push([`req-${slug}-${skillSlug}-${level}`, `role-${slug}`, `skill-${skillSlug}`, target, importance, level, weight]);
      }
    }
    await run(
      `INSERT INTO role_skill_requirements (id, role_id, skill_id, target_level, importance, experience_level, weight)
       VALUES ${placeholders(rows.length, 7)}
       ON CONFLICT (role_id, skill_id, experience_level)
       DO UPDATE SET target_level=EXCLUDED.target_level, importance=EXCLUDED.importance, weight=EXCLUDED.weight`,
      rows.flat(),
    );
  }

  console.log(`Seeded ${skills.length} technical + ${softSkills.length} soft skills and ${roles.length} roles.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
