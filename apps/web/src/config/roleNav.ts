import { DashboardNavItem } from "../components/layout/DashboardLayout";

export const testerNavItems: DashboardNavItem[] = [
  { key: "dashboard_home", label: "Dashboard", icon: "D" },
  { key: "create_test_case", label: "Create Test Case", icon: "+" },
  { key: "test_cases", label: "Test Cases", icon: "T" },
  { key: "templates", label: "Templates", icon: "M" },
  { key: "bulk_operations", label: "Bulk Operations", icon: "B" },
  { key: "import_test_cases", label: "Import Test Cases", icon: "I" },
  { key: "suite_management", label: "Test Suites", icon: "S" },
  { key: "test_runs", label: "Test Run Management", icon: "R" },
  { key: "execute_tests", label: "Execute Tests", icon: "E" },
  { key: "bug_management", label: "Bug Management", icon: "!" },
  { key: "reports", label: "Reports", icon: "P" },
];

export const developerNavItems: DashboardNavItem[] = [
  { key: "dashboard_home", label: "Dashboard", icon: "D" },
  { key: "my_assigned_bugs", label: "My Assigned Bugs", icon: "!" },
  { key: "test_reports", label: "Test Reports", icon: "P" },
  { key: "performance_report", label: "Performance Report", icon: "F" },
  { key: "linked_commits", label: "Linked Commits", icon: "C" },
];

export const adminNavItems: DashboardNavItem[] = [
  { key: "dashboard_home", label: "Dashboard", icon: "D" },
  { key: "user_management", label: "User Management", icon: "U" },
  { key: "role_management", label: "Role Management", icon: "L" },
  { key: "project_management", label: "Project Management", icon: "J" },
  { key: "audit_logs", label: "Audit Logs", icon: "A" },
  { key: "backup_management", label: "Backup Management", icon: "K" },
];

const allNavItemsCatalog: DashboardNavItem[] = [
  ...testerNavItems,
  ...developerNavItems,
  ...adminNavItems,
].filter((item, idx, arr) => arr.findIndex((x) => x.key === item.key) === idx);

const permissionToMenuKeys: Record<string, string[]> = {
  "Manage Users": ["user_management"],
  "Manage Roles": ["role_management"],
  "Manage Projects": ["project_management"],
  "View Audit Logs": ["audit_logs"],
  "Backup Management": ["backup_management"],
  "Create Test Cases": [
    "create_test_case",
    "test_cases",
    "templates",
    "bulk_operations",
    "import_test_cases",
    "suite_management",
    "test_runs",
  ],
  "Execute Tests": ["execute_tests"],
  "Bug Management": ["bug_management"],
  Reports: ["reports"],
  "My Assigned Bugs": ["my_assigned_bugs"],
  "All Bugs": ["all_bugs"],
  "Test Reports": ["test_reports"],
  "Performance Report": ["performance_report"],
  "Linked Commits": ["linked_commits"],
};

export const permissionCatalog = [
  "Manage Users",
  "Manage Projects",
  "Manage Roles",
  "View Audit Logs",
  "Backup Management",
  "Create Test Cases",
  "Execute Tests",
  "Bug Management",
  "Reports",
  "My Assigned Bugs",
  "All Bugs",
  "Test Reports",
  "Performance Report",
  "Linked Commits",
];

export const buildNavFromPermissions = (
  roleKey: string,
  map: Record<string, string[]>
): DashboardNavItem[] => {
  const defaultBase =
    roleKey === "TESTER" ? testerNavItems : roleKey === "DEVELOPER" ? developerNavItems : adminNavItems;
  const allByKey = new Map(allNavItemsCatalog.map((item) => [item.key, item]));
  const allowedPermissions = map[roleKey] || [];
  const allowedKeys = new Set<string>(defaultBase.map((item) => item.key));
  allowedKeys.add("dashboard_home");

  allowedPermissions.forEach((permission) => {
    const keys = permissionToMenuKeys[permission] || [];
    keys.forEach((key) => allowedKeys.add(key));

    const matched = allNavItemsCatalog.find(
      (item) => item.label.toUpperCase() === String(permission).toUpperCase()
    );
    if (matched) allowedKeys.add(matched.key);
  });

  return Array.from(allowedKeys)
    .map((key) => allByKey.get(key))
    .filter((item): item is DashboardNavItem => Boolean(item));
};
