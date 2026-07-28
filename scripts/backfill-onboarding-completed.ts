/**
 * Marks accounts that already existed before first-login onboarding shipped
 * as completed, so only new signups see the stepper.
 *
 * Safe to re-run: only touches rows where onboardingCompletedAt IS NULL and
 * createdAt is older than a short grace window (avoids racing brand-new signups
 * during deploy).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const GRACE_MS = 2 * 60 * 1000;

async function main() {
  const cutoff = new Date(Date.now() - GRACE_MS);
  const result = await prisma.user.updateMany({
    where: {
      onboardingCompletedAt: null,
      createdAt: { lt: cutoff },
    },
    data: {
      onboardingCompletedAt: new Date(),
    },
  });

  console.log(
    `Backfilled onboardingCompletedAt for ${result.count} existing user(s).`,
  );
}

main()
  .catch((error) => {
    console.error("Onboarding backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
