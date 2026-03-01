/* eslint-disable no-console */
const path = require("path");
const { spawn } = require("child_process");
const bcrypt = require("bcrypt");
const { PrismaClient, Role } = require("@prisma/client");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", "..", ".env"), override: false });

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE_URL || "http://localhost:4000";

const USERS = {
  admin: {
    name: "Demo Admin",
    email: "demo.admin@testtrack.local",
    password: "Admin@123",
    role: Role.ADMIN,
  },
  tester: {
    name: "Demo Tester",
    email: "demo.tester@testtrack.local",
    password: "Tester@123",
    role: Role.TESTER,
  },
  developer: {
    name: "Demo Developer",
    email: "demo.developer@testtrack.local",
    password: "Developer@123",
    role: Role.DEVELOPER,
  },
};

const authCases = [
  {
    title: "AUTH - Login with valid credentials",
    description: "Validate successful login flow for active verified user.",
    priority: "HIGH",
    estimatedDurationMinutes: 8,
    automationStatus: "AUTOMATED",
    tags: ["auth", "login", "smoke"],
    steps: [
      {
        stepNumber: 1,
        action: "Open login page and confirm fields are visible.",
        testData: { email: "qa.user@company.com" },
        expectedResult: "Email and password fields, Login button, and Forgot Password link are displayed.",
      },
      {
        stepNumber: 2,
        action: "Enter valid email and valid password.",
        testData: { email: "qa.user@company.com", password: "Valid@123" },
        expectedResult: "Credentials are accepted without client-side validation errors.",
      },
      {
        stepNumber: 3,
        action: "Click Login button.",
        testData: {},
        expectedResult: "User is redirected to dashboard and valid session token is issued.",
      },
    ],
  },
  {
    title: "AUTH - Login with invalid password",
    description: "Ensure login is denied for wrong password.",
    priority: "HIGH",
    estimatedDurationMinutes: 6,
    automationStatus: "IN_PROGRESS",
    tags: ["auth", "login", "negative"],
    steps: [
      {
        stepNumber: 1,
        action: "Open login page.",
        testData: {},
        expectedResult: "Login page loads successfully.",
      },
      {
        stepNumber: 2,
        action: "Enter valid email and incorrect password.",
        testData: { email: "qa.user@company.com", password: "Wrong@123" },
        expectedResult: "Form accepts input and submission is enabled.",
      },
      {
        stepNumber: 3,
        action: "Submit login form.",
        testData: {},
        expectedResult: "Error message 'Invalid credentials' is shown and login is blocked.",
      },
    ],
  },
  {
    title: "AUTH - Logout from active session",
    description: "Validate user logout invalidates current session.",
    priority: "MEDIUM",
    estimatedDurationMinutes: 5,
    automationStatus: "AUTOMATED",
    tags: ["auth", "logout"],
    steps: [
      {
        stepNumber: 1,
        action: "Login with valid user.",
        testData: { email: "qa.user@company.com", password: "Valid@123" },
        expectedResult: "User lands on dashboard with authenticated session.",
      },
      {
        stepNumber: 2,
        action: "Click account menu and select Logout.",
        testData: {},
        expectedResult: "User is redirected to login page and auth token/cookie is cleared.",
      },
      {
        stepNumber: 3,
        action: "Try opening protected dashboard URL directly.",
        testData: {},
        expectedResult: "Access is denied and user is redirected to login.",
      },
    ],
  },
  {
    title: "AUTH - Forgot password email trigger",
    description: "Verify reset link request for registered email.",
    priority: "HIGH",
    estimatedDurationMinutes: 7,
    automationStatus: "NOT_AUTOMATED",
    tags: ["auth", "password-reset", "email"],
    steps: [
      {
        stepNumber: 1,
        action: "Open forgot password screen.",
        testData: {},
        expectedResult: "Forgot password form is displayed.",
      },
      {
        stepNumber: 2,
        action: "Enter registered email and submit.",
        testData: { email: "qa.user@company.com" },
        expectedResult: "Success message indicates reset link was sent.",
      },
      {
        stepNumber: 3,
        action: "Verify reset email delivery in mailbox/log.",
        testData: {},
        expectedResult: "Reset email exists and contains valid tokenized link.",
      },
    ],
  },
  {
    title: "AUTH - Reset password with valid token",
    description: "Validate password update using valid non-expired token.",
    priority: "HIGH",
    estimatedDurationMinutes: 9,
    automationStatus: "IN_PROGRESS",
    tags: ["auth", "password-reset", "token"],
    steps: [
      {
        stepNumber: 1,
        action: "Open reset link from received email.",
        testData: { token: "<valid token>" },
        expectedResult: "Reset password page opens for valid token.",
      },
      {
        stepNumber: 2,
        action: "Enter strong new password and confirmation.",
        testData: { newPassword: "NewStrong@123", confirmPassword: "NewStrong@123" },
        expectedResult: "Password validation passes and submission is enabled.",
      },
      {
        stepNumber: 3,
        action: "Submit reset form and then login with new password.",
        testData: { email: "qa.user@company.com", password: "NewStrong@123" },
        expectedResult: "Password is updated and user can login with new password.",
      },
    ],
  },
  {
    title: "AUTH - Account lock after repeated failures",
    description: "Validate lockout behavior after consecutive failed login attempts.",
    priority: "CRITICAL",
    estimatedDurationMinutes: 10,
    automationStatus: "NOT_AUTOMATED",
    tags: ["auth", "security", "lockout"],
    steps: [
      {
        stepNumber: 1,
        action: "Attempt login with invalid password repeatedly for configured threshold.",
        testData: { attempts: 5, email: "qa.user@company.com", password: "Wrong@123" },
        expectedResult: "Each failed attempt increments failure counter and returns error.",
      },
      {
        stepNumber: 2,
        action: "Attempt login again after threshold reached.",
        testData: { email: "qa.user@company.com", password: "Wrong@123" },
        expectedResult: "Account is temporarily locked and lockout message is shown.",
      },
      {
        stepNumber: 3,
        action: "Attempt login with correct password during lockout window.",
        testData: { email: "qa.user@company.com", password: "Valid@123" },
        expectedResult: "Login remains blocked until lockout duration expires.",
      },
    ],
  },
];

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(method, url, body, token) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const msg = payload?.message || `${method} ${url} failed with ${res.status}`;
    throw new Error(msg);
  }
  return payload;
}

async function ensureUsers() {
  const upserted = {};
  for (const key of Object.keys(USERS)) {
    const u = USERS[key];
    const hashed = await bcrypt.hash(u.password, 10);
    upserted[key] = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        password: hashed,
        role: u.role,
        isVerified: true,
        isActive: true,
        passwordHistory: [hashed],
        verificationToken: null,
        verificationExpiry: null,
      },
      create: {
        name: u.name,
        email: u.email,
        password: hashed,
        role: u.role,
        isVerified: true,
        isActive: true,
        passwordHistory: [hashed],
      },
      select: { id: true, name: true, email: true, role: true },
    });
  }
  return upserted;
}

async function login(email, password) {
  const data = await request("POST", `${API_BASE}/api/auth/login`, { email, password });
  return data.accessToken || data.token;
}

function maybeStartServer() {
  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  return spawn(cmd, ["ts-node", "src/index.ts"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "pipe",
    env: process.env,
  });
}

async function ensureApiReady() {
  for (let i = 0; i < 3; i += 1) {
    try {
      const res = await fetch(`${API_BASE}/`);
      if (res.ok) return null;
    } catch {}
    await wait(700);
  }

  const child = maybeStartServer();
  let bootLog = "";
  child.stdout.on("data", (d) => {
    bootLog += d.toString();
  });
  child.stderr.on("data", (d) => {
    bootLog += d.toString();
  });

  for (let i = 0; i < 35; i += 1) {
    await wait(500);
    try {
      const res = await fetch(`${API_BASE}/`);
      if (res.ok) return child;
    } catch {}
    if (child.exitCode !== null) break;
  }

  throw new Error(`API server did not start in time. Logs:\n${bootLog}`);
}

async function main() {
  let server = null;
  const checks = [];
  try {
    console.log("Preparing users...");
    const users = await ensureUsers();

    console.log("Ensuring API is reachable...");
    server = await ensureApiReady();

    console.log("Logging in users...");
    const adminToken = await login(USERS.admin.email, USERS.admin.password);
    const testerToken = await login(USERS.tester.email, USERS.tester.password);

    console.log("Creating project...");
    const project = await request(
      "POST",
      `${API_BASE}/api/admin/projects`,
      { name: "Authentication Demo Project", description: "Seeded demo project for 4.2/4.3/4.5 validation" },
      adminToken
    );
    checks.push(["project_created", Boolean(project?.id)]);

    console.log("Creating 6 authentication test cases...");
    const createdCases = [];
    for (let i = 0; i < authCases.length; i += 1) {
      const tc = authCases[i];
      const created = await request(
        "POST",
        `${API_BASE}/api/testcases`,
        {
          title: tc.title,
          description: tc.description,
          module: "Authentication",
          priority: tc.priority,
          severity: "MAJOR",
          type: "FUNCTIONAL",
          status: "READY",
          tags: tc.tags,
          estimatedDurationMinutes: tc.estimatedDurationMinutes,
          automationStatus: tc.automationStatus,
          automationScriptLink: tc.automationStatus === "AUTOMATED" ? "https://repo.local/auth-tests" : null,
          preConditions: ["User account exists", "Application is reachable"],
          testDataRequirements: ["Auth test account credentials", "Email inbox access for reset tests"],
          environmentRequirements: ["QA environment", "Stable internet connection", "Latest Chrome browser"],
          postConditions: ["User session state cleaned up"],
          metadata: { feature: "Authentication", seedBatch: "4.2-4.3-4.5" },
          steps: tc.steps,
          projectId: project.id,
          assignedTo: users.tester.id,
        },
        testerToken
      );
      createdCases.push(created);
    }
    checks.push(["six_testcases_created", createdCases.length === 6]);

    console.log("Creating STATIC and DYNAMIC suites...");
    const staticSuite = await request(
      "POST",
      `${API_BASE}/api/suites`,
      {
        name: "Authentication Regression Suite",
        description: "Static suite for ordered authentication regression checks",
        module: "Authentication",
        type: "STATIC",
        projectId: project.id,
        testCaseIds: [createdCases[0].id, createdCases[1].id, createdCases[2].id],
      },
      testerToken
    );
    const dynamicSuite = await request(
      "POST",
      `${API_BASE}/api/suites`,
      {
        name: "Authentication Dynamic High Priority",
        description: "Dynamic suite filtered by module and high priority",
        module: "Authentication",
        type: "DYNAMIC",
        projectId: project.id,
        filterJson: { module: "Authentication", priority: "HIGH" },
      },
      testerToken
    );
    checks.push(["static_suite_created", Boolean(staticSuite?.id)]);
    checks.push(["dynamic_suite_created", Boolean(dynamicSuite?.id)]);

    console.log("Verifying suite reorder...");
    const reorderedIds = [createdCases[2].id, createdCases[0].id, createdCases[1].id];
    await request(
      "PUT",
      `${API_BASE}/api/test-suites/${staticSuite.id}/reorder`,
      { testCaseIds: reorderedIds },
      testerToken
    );
    const staticSuiteDetails = await request("GET", `${API_BASE}/api/suites/${staticSuite.id}`, undefined, testerToken);
    const actualOrder = (staticSuiteDetails?.suiteCases || []).map((x) => x.testCaseId);
    checks.push(["suite_reorder_works", JSON.stringify(actualOrder) === JSON.stringify(reorderedIds)]);

    console.log("Creating test run by starting suite execution...");
    const suiteExecution = await request(
      "POST",
      `${API_BASE}/api/suite-executions`,
      { suiteId: staticSuite.id, mode: "SEQUENTIAL", testerIds: [users.tester.id] },
      testerToken
    );
    checks.push(["suite_execution_created", Boolean(suiteExecution?.id)]);
    checks.push(["linked_test_run_created", Boolean(suiteExecution?.linkedTestRunId)]);

    console.log("Simulating execution with step updates...");
    const testCaseForExecution = createdCases[0];
    const startedExecution = await request(
      "POST",
      `${API_BASE}/api/executions/start`,
      { testCaseId: testCaseForExecution.id, testRunId: suiteExecution.linkedTestRunId, notes: "Seed execution run" },
      testerToken
    );
    const failedStepNumber = 2;
    const stepStatuses = ["PASSED", "FAILED", "SKIPPED"];
    for (let i = 0; i < testCaseForExecution.steps.length; i += 1) {
      await request(
        "PUT",
        `${API_BASE}/api/executions/${startedExecution.id}/step`,
        {
          stepNumber: testCaseForExecution.steps[i].stepNumber,
          status: stepStatuses[i] || "PASSED",
          actualResult:
            stepStatuses[i] === "FAILED"
              ? "Observed validation error and backend 500 response."
              : "Step executed successfully in seeded simulation.",
          evidence:
            stepStatuses[i] === "FAILED"
              ? [
                  {
                    fileType: "IMAGE",
                    fileUrl: "https://files.local/failure-step-2.png",
                    fileName: "failure-step-2.png",
                    notes: "UI error screenshot",
                  },
                ]
              : [],
        },
        testerToken
      );
    }

    console.log("Creating linked bug from failed step...");
    const createdBug = await request(
      "POST",
      `${API_BASE}/api/executions/${startedExecution.id}/create-bug`,
      {
        stepNumber: failedStepNumber,
        environment: "QA",
        severity: "HIGH",
        assignedTo: users.developer.id,
      },
      testerToken
    );
    checks.push(["bug_linked_to_execution", createdBug?.executionId === startedExecution.id]);

    console.log("Finalizing execution and re-executing...");
    const finalized = await request(
      "POST",
      `${API_BASE}/api/executions/${startedExecution.id}/finalize`,
      { notes: "Finalized by seed script" },
      testerToken
    );
    checks.push(["execution_result_autocalculated_failed", finalized?.result === "FAILED"]);

    const reexecution = await request(
      "POST",
      `${API_BASE}/api/executions/${startedExecution.id}/re-execute`,
      { notes: "Retry after bug creation" },
      testerToken
    );
    checks.push(["reexecution_created", Boolean(reexecution?.id && reexecution?.isDraft === true)]);

    console.log("Validating version history and clone version reset...");
    await request(
      "PUT",
      `${API_BASE}/api/testcases/${testCaseForExecution.id}`,
      {
        changeSummary: "Refined expected result wording for step 1.",
        description: `${testCaseForExecution.description} (edited by seed script)`,
      },
      testerToken
    );
    const versions = await request(
      "GET",
      `${API_BASE}/api/testcases/${testCaseForExecution.id}/versions`,
      undefined,
      testerToken
    );
    checks.push(["version_history_created_on_edit", Array.isArray(versions) && versions.length >= 1]);

    const clonedCase = await request(
      "POST",
      `${API_BASE}/api/testcases/${testCaseForExecution.id}/clone`,
      { titleSuffix: " (Seed Copy)", includeAttachments: false },
      testerToken
    );
    checks.push(["clone_resets_version", clonedCase?.version === 1]);

    console.log("Checking audit logs...");
    const auditLogs = await request("GET", `${API_BASE}/api/admin/audit-logs`, undefined, adminToken);
    const auditCount = Array.isArray(auditLogs) ? auditLogs.length : 0;
    checks.push(["audit_logs_created", auditCount > 0]);

    const summary = {
      users: {
        admin: users.admin.email,
        tester: users.tester.email,
        developer: users.developer.email,
      },
      projectId: project.id,
      staticSuiteId: staticSuite.id,
      dynamicSuiteId: dynamicSuite.id,
      suiteExecutionId: suiteExecution.id,
      linkedTestRunId: suiteExecution.linkedTestRunId,
      executionId: startedExecution.id,
      bugId: createdBug.id,
      clonedTestCaseId: clonedCase.id,
      checks: checks.map(([name, ok]) => ({ name, ok })),
    };

    console.log("\nSeed complete.");
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
