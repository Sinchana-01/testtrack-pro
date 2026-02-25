const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const logs = await prisma.auditLog.findMany({
    where: { action: { in: ["LOGIN_SUCCESS", "LOGIN_FAILED"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log(logs);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
