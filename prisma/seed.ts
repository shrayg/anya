import { PrismaClient } from '@prisma/client'

import bcrypt from 'bcryptjs'



const prisma = new PrismaClient()



async function main() {

  const adminPassword = '§/DV$R-FDGDU8-DHGZG$-)(GDF§B-DZGZG§-76475-23476-5882-36363'

  const hashedPassword = await bcrypt.hash(adminPassword, 10)



  await prisma.user.updateMany({

    data: { isAdmin: false },

  })



  const admin = await prisma.user.upsert({

    where: { username: 'admin' },

    update: {

      password: hashedPassword,

      isAdmin: true,

      staffRole: "admin",

      accountStatus: "active",

      plan: "enterprise",

      enterpriseTier: true,

      subscripted: true,

      freeTier: false,

    },

    create: {

      username: 'admin',

      password: hashedPassword,

      isAdmin: true,

      staffRole: "admin",

      accountStatus: "active",

      plan: "enterprise",

      enterpriseTier: true,

      subscripted: true,

      freeTier: false,

    },

  })



  console.log({ admin })

  await prisma.user.updateMany({
    where: { staffRole: "admin" },
    data: { isAdmin: true },
  })
}



main()

  .then(async () => {

    await prisma.$disconnect()

  })

  .catch(async (e) => {

    console.error(e)

    await prisma.$disconnect()

    process.exit(1)

  })

