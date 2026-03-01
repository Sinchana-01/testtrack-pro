const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  await prisma.user.update({
    where: { email: process.argv[2] },
    data: { isVerified: true, verificationToken: null, verificationExpiry: null },
  });
  await prisma.$disconnect();
})();