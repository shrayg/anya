import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD =
  "§/DV$R-FDGDU8-DHGZG$-)(GDF§B-DZGZG§-76475-23476-5882-36363";

async function main() {
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await prisma.user.updateMany({
    data: { isAdmin: false },
  });

  const admin = await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {
      password: hashedPassword,
      isAdmin: true,
      accountStatus: "active",
      plan: "enterprise",
      enterpriseTier: true,
      subscripted: true,
      freeTier: false,
    },
    create: {
      username: ADMIN_USERNAME,
      password: hashedPassword,
      isAdmin: true,
      accountStatus: "active",
      plan: "enterprise",
      enterpriseTier: true,
      subscripted: true,
      freeTier: false,
    },
  });

  const adminCount = await prisma.user.count({ where: { isAdmin: true } });

  console.log(`Sole admin: ${admin.username} (id ${admin.id})`);
  console.log(`Total admin accounts: ${adminCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
