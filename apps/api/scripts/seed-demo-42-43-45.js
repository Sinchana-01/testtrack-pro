const { PrismaClient, Role } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:4000/api";

const ADMIN_EMAIL = "admin.demo@company.com";
const TESTER_EMAIL = "tester.demo@company.com";
const DEV_EMAIL = "developer.demo@company.com";
const PASSWORD = "Demo@1234";

const request = async (method, path, body, token) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} failed (${res.status}): ${json.message || text}`);
  }
  return json;
};

const ensureDemoUsers = async () => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const common = {
    password: hash,
    isVerified: true,
    isActive: true,
    tokenVersion: 0,
    passwordHistory: [hash],
    verificationToken: null,
    verificationExpiry: null,
    resetToken: null,
    resetTokenExpiry: null,
  };

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { ...common, role: Role.ADMIN, name: "Demo Admin" },
    create: { ...common, role: Role.ADMIN, name: "Demo Admin", email: ADMIN_EMAIL },
  });
  const tester = await prisma.user.upsert({
    where: { email: TESTER_EMAIL },
    update: { ...common, role: Role.TESTER, name: "Demo Tester" },
    create: { ...common, role: Role.TESTER, name: "Demo Tester", email: TESTER_EMAIL },
  });
  const developer = await prisma.user.upsert({
    where: { email: DEV_EMAIL },
    update: { ...common, role: Role.DEVELOPER, name: "Demo Developer" },
    create: { ...common, role: Role.DEVELOPER, name: "Demo Developer", email: DEV_EMAIL },
  });
  return { admin, tester, developer };
};

const login = async (email) => {
  const data = await request("POST", "/auth/login", { email, password: PASSWORD });
  return data.accessToken || data.token;
};

const makeDetailedSteps = (prefix) => [
  {
    stepNumber: 1,
    action: `[${prefix}] Launch app and navigate to login page.`,
    testData: "Browser: Chrome latest, URL: /login",
    expectedResult: "Login screen loads with email/password fields and submit button.",
  },
  {
    stepNumber: 2,
    action: `[${prefix}] Enter valid registered credentials.`,
    testData: "email=tester.demo@company.com, password=Demo@1234",
    expectedResult: "Form accepts input with no validation errors.",
  },
  {
    stepNumber: 3,
    action: `[${prefix}] Click Login and wait for auth API completion.`,
    testData: "POST /api/auth/login",
    expectedResult: "User is authenticated and redirected to dashboard.",
  },
  {
    stepNumber: 4,
    action: `[${prefix}] Verify session token and role-based navigation availability.`,
    testData: "JWT access token in storage",
    expectedResult: "Session token is present and menus match user role permissions.",
  },
  {
    stepNumber: 5,
    action: `[${prefix}] Perform logout action from header menu.`,
    testData: "Click Logout",
    expectedResult: "Session invalidated and user returned to login page.",
  },
];

const run = async () => {
  const health = await fetch("http://localhost:4000/");
  if (!health.ok) {
    throw new Error("API server is not reachable on http://localhost:4000");
  }

  const users = await ensureDemoUsers();
  const adminToken = await login(ADMIN_EMAIL);
  const testerToken = await login(TESTER_EMAIL);

  const project = await request(
    "POST",
    "/admin/projects",
    { name: "Authentication Core Project", description: "Demo project for modules 4.2/4.3/4.5" },
    adminToken
  );

  const testCasePayloads = [
    {
      title: "Authentication - Valid Login Flow",
      priority: "HIGH",
      tags: ["auth", "login", "smoke", "critical"],
      estimatedDurationMinutes: 12,
      automationStatus: "AUTOMATED",
    },
    {
      title: "Authentication - Invalid Password Validation",
      priority: "HIGH",
      tags: ["auth", "negative", "validation"],
      estimatedDurationMinutes: 10,
      automationStatus: "IN_PROGRESS",
    },
    {
      title: "Authentication - Password Reset with Email Link",
      priority: "HIGH",
      tags: ["auth", "reset-password", "email"],
      estimatedDurationMinutes: 14,
      automationStatus: "NOT_AUTOMATED",
    },
    {
      title: "Authentication - Session Expiry and Re-Login",
      priority: "MEDIUM",
      tags: ["auth", "session", "security"],
      estimatedDurationMinutes: 9,
      automationStatus: "AUTOMATED",
    },
    {
      title: "Authentication - Multi-factor Prompt Handling",
      priority: "MEDIUM",
      tags: ["auth", "mfa", "ux"],
      estimatedDurationMinutes: 11,
      automationStatus: "NOT_AUTOMATED",
    },
    {
      title: "Authentication - Account Lockout After Failed Attempts",
      priority: "HIGH",
      tags: ["auth", "security", "lockout"],
      estimatedDurationMinutes: 13,
      automationStatus: "IN_PROGRESS",
    },
  ];

  const createdCases = [];
  for (let i = 0; i < testCasePayloads.length; i += 1) {
    const tc = testCasePayloads[i];
    const created = await request(
      "POST",
      "/testcases",
      {
        title: tc.title,
        description: `${tc.title} detailed verification with preconditions, execution steps and expected outcomes.`,
        preConditions: [
          "User account exists and is active",
          "Authentication service and DB are reachable",
          "Project baseline data is loaded",
        ],
        testDataRequirements: ["Valid and invalid credential sets", "OTP/email inbox access when required"],
        environmentRequirements: ["Staging environment", "Chrome latest", "API base URL configured"],
        postConditions: ["System state restored", "No test-only account lock persisted unintentionally"],
        metadata: { moduleArea: "Authentication", objective: "4.2 quality baseline" },
        module: "Authentication",
        steps: makeDetailedSteps(`TC${i + 1}`),
        priority: tc.priority,
        severity: "MAJOR",
        type: "FUNCTIONAL",
        status: "READY",
        tags: tc.tags,
        estimatedDurationMinutes: tc.estimatedDurationMinutes,
        automationStatus: tc.automationStatus,
        automationScriptLink: tc.automationStatus === "AUTOMATED" ? `https://repo.local/tests/auth/${i + 1}` : null,
        projectId: project.id,
      },
      testerToken
    );
    createdCases.push(created);
  }

  const staticSuite = await request(
    "POST",
    "/suites",
    {
      name: "Authentication Regression Suite",
      description: "Static ordered suite for regression validation",
      module: "Authentication",
      type: "STATIC",
      testCaseIds: [createdCases[0].id, createdCases[1].id, createdCases[2].id],
      projectId: project.id,
    },
    testerToken
  );

  const dynamicSuite = await request(
    "POST",
    "/suites",
    {
      name: "Authentication Dynamic High Priority Suite",
      description: "Dynamic suite filtered by module + high priority",
      module: "Authentication",
      type: "DYNAMIC",
      filterJson: {
        modules: ["Authentication"],
        priorities: ["HIGH"],
      },
      projectId: project.id,
    },
    testerToken
  );

  const reorderResult = await request(
    "PUT",
    `/test-suites/${staticSuite.id}/reorder`,
    { testCaseIds: [createdCases[2].id, createdCases[0].id, createdCases[1].id] },
    testerToken
  );

  const orderedSuiteCases = await request("GET", `/suites/${staticSuite.id}/test-cases`, undefined, testerToken);

  const suiteExecution = await request(
    "POST",
    "/suite-executions",
    {
      suiteId: staticSuite.id,
      mode: "SEQUENTIAL",
      testerIds: [users.tester.id],
    },
    testerToken
  );

  const suiteExecutionDetail = await request(
    "GET",
    `/suite-executions/${suiteExecution.id}`,
    undefined,
    testerToken
  );
  const linkedRunId = suiteExecutionDetail.linkedTestRun?.id;
  const firstRunCaseTestCaseId = suiteExecutionDetail.cases?.[0]?.testCaseId;
  if (!linkedRunId || !firstRunCaseTestCaseId) {
    throw new Error("Failed to resolve linked run or first test case from suite execution");
  }

  const startedExecution = await request(
    "POST",
    "/executions/start",
    {
      testCaseId: firstRunCaseTestCaseId,
      testRunId: linkedRunId,
      notes: "Demo execution start",
    },
    testerToken
  );

  const stepResults = Array.isArray(startedExecution.stepResults) ? startedExecution.stepResults : [];
  if (stepResults.length === 0) {
    throw new Error("Started execution has no steps");
  }

  let failedStepNumber = 2;
  for (const step of stepResults) {
    const stepNumber = Number(step.stepNumber);
    const failed = stepNumber === failedStepNumber;
    await request(
      "PUT",
      `/executions/${startedExecution.id}/step`,
      {
        stepNumber,
        status: failed ? "FAILED" : "PASSED",
        actualResult: failed
          ? `Observed mismatch in expected behavior at step ${stepNumber}`
          : `Step ${stepNumber} executed successfully`,
        notes: failed ? "Intentional failure for demo bug creation" : "Demo pass",
        evidence: failed
          ? [{ fileType: "IMAGE", fileUrl: "https://example.local/evidence/failure.png", fileName: "failure.png" }]
          : undefined,
      },
      testerToken
    );
  }

  const createdBug = await request(
    "POST",
    `/executions/${startedExecution.id}/create-bug`,
    {
      stepNumber: failedStepNumber,
      environment: "Staging / Chrome latest",
      severity: "HIGH",
      assignedTo: users.developer.id,
    },
    testerToken
  );

  const finalizedExecution = await request(
    "POST",
    `/executions/${startedExecution.id}/finalize`,
    { notes: "Execution finalized for demo dataset" },
    testerToken
  );

  const reExecution = await request(
    "POST",
    `/executions/${startedExecution.id}/re-execute`,
    { notes: "Retry after fix simulation" },
    testerToken
  );

  const editedCase = await request(
    "PUT",
    `/testcases/${createdCases[0].id}`,
    {
      description: `${createdCases[0].description} (edited for version history demo)`,
      changeSummary: "Updated description to generate version history entry",
    },
    testerToken
  );

  const versions = await request("GET", `/testcases/${createdCases[0].id}/versions`, undefined, testerToken);
  const clonedCase = await request("POST", `/testcases/${createdCases[0].id}/clone`, {}, testerToken);

  const auditCount = await prisma.auditLog.count();
  const auditSample = await prisma.auditLog.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    select: { action: true },
  });
  const auditActions = [...new Set(auditSample.map((row) => row.action))];

  const summary = {
    users: {
      admin: ADMIN_EMAIL,
      tester: TESTER_EMAIL,
      developer: DEV_EMAIL,
    },
    project: { id: project.id, name: project.name },
    testCasesCreated: createdCases.length,
    staticSuite: {
      id: staticSuite.id,
      name: staticSuite.name,
      orderedCaseIdsAfterReorder: orderedSuiteCases.testCases.map((row) => row.id),
      reorderValidated: JSON.stringify(reorderResult.orderedTestCaseIds || []) === JSON.stringify(orderedSuiteCases.testCases.map((row) => row.id)),
    },
    dynamicSuite: {
      id: dynamicSuite.id,
      name: dynamicSuite.name,
      filterJson: dynamicSuite.filterJson,
    },
    testRun: {
      linkedRunId,
      suiteExecutionId: suiteExecution.id,
      assignedTesterId: users.tester.id,
    },
    execution: {
      executionId: startedExecution.id,
      finalizedResult: finalizedExecution.result,
      autoCalculatedResultFailed: finalizedExecution.result === "FAILED",
      reExecutionId: reExecution.id,
    },
    bug: {
      id: createdBug.id,
      linkedExecutionId: createdBug.executionId,
      linked: createdBug.executionId === startedExecution.id,
    },
    versioning: {
      editedVersion: editedCase.version,
      versionHistoryCount: Array.isArray(versions) ? versions.length : 0,
      cloneVersion: clonedCase.version,
      cloneVersionReset: clonedCase.version === 1,
    },
    audit: {
      totalLogs: auditCount,
      sampleActions: auditActions,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
};

run()
  .catch((error) => {
    console.error("SEED_DEMO_ERROR:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

