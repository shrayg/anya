import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      isAdmin: true,
      accountStatus: true,
      plan: true,
    },
  });

  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch((error) => {
    console.error("ERROR:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
