import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function createPackagesForAllTeachers() {
  try {
    // Get all teachers with their instruments and tiers
    const teachers = await prisma.teachers.findMany({
      include: {
        profiles: true,
        class_packages: true,
        teacher_instruments: {
          where: { teach_or_perform: 'Teach' },
          include: {
            teacher_instrument_tiers: true
          }
        }
      }
    });

    console.log(`📊 Found ${teachers.length} teachers\n`);

    let created = 0;
    let skipped = 0;

    for (const teacher of teachers) {
      // Skip if teacher already has packages
      if (teacher.class_packages.length > 0) {
        console.log(`⏭️  ${teacher.profiles?.name || teacher.id}: Already has ${teacher.class_packages.length} packages`);
        skipped++;
        continue;
      }

      // Skip if no teaching instruments
      if (!teacher.teacher_instruments || teacher.teacher_instruments.length === 0) {
        console.log(`⏭️  ${teacher.profiles?.name || teacher.id}: No teaching instruments`);
        skipped++;
        continue;
      }

      // Get beginner tier price from first teaching instrument
      const firstInstrument = teacher.teacher_instruments[0];
      const beginnerTier = firstInstrument.teacher_instrument_tiers.find(t => t.level === 'beginner');

      if (!beginnerTier || !beginnerTier.price_inr) {
        console.log(`⏭️  ${teacher.profiles?.name || teacher.id}: No beginner tier pricing`);
        skipped++;
        continue;
      }

      const basePrice = parseInt(String(beginnerTier.price_inr));

      // Create 3 packages: 10, 20, 30 sessions
      const packages = [
        {
          teacher_id: teacher.id,
          name: '10 Sessions Package',
          description: 'Perfect for beginners to get started',
          classes_count: 10,
          validity_days: 90,
          price: basePrice * 10,
          is_active: true
        },
        {
          teacher_id: teacher.id,
          name: '20 Sessions Package',
          description: 'Most popular choice for consistent learning',
          classes_count: 20,
          validity_days: 120,
          price: basePrice * 20,
          is_active: true
        },
        {
          teacher_id: teacher.id,
          name: '30 Sessions Package',
          description: 'Best value for committed learners',
          classes_count: 30,
          validity_days: 180,
          price: basePrice * 30,
          is_active: true
        }
      ];

      for (const pkg of packages) {
        await prisma.class_packages.create({ data: pkg });
      }

      console.log(`✅ ${teacher.profiles?.name || teacher.id}: Created 3 packages (base: ₹${basePrice})`);
      created++;
    }

    console.log(`\n📈 Summary:`);
    console.log(`   Created packages for: ${created} teachers`);
    console.log(`   Skipped: ${skipped} teachers`);
    console.log(`\n🎉 Done!`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createPackagesForAllTeachers();
