
 
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { pool, connectDB } = require('../config/db');
const Admin   = require('../models/Admin');
const Product = require('../models/Product');


const SAMPLE_PRODUCTS = [
  {
    name: 'Yirgacheffe Grade 1',
    category: 'green-beans',
    description: 'Premium washed coffee with bright floral aroma and citrus notes.',
    pricePerKg: 145.00,
    minOrderKg: 50,
    stock: 5000,
    region: 'Yirgacheffe',
    process: 'washed',
    grade: 'Grade 1',
    image: 'images/greencoffeebeans.webp',
  },
  {
    name: 'Sidama Natural Export',
    category: 'green-beans',
    description: 'Dry-processed Arabica with fruity sweetness and complex body.',
    pricePerKg: 132.00,
    minOrderKg: 50,
    stock: 4000,
    region: 'Sidama',
    process: 'natural',
    grade: 'Grade 2',
    image: 'images/green-coffee-beans-01.jpg',
  },
  {
    name: 'Harar Longberry',
    category: 'specialty',
    description: 'Wild-grown Ethiopian coffee with winey notes and bold character.',
    pricePerKg: 138.00,
    minOrderKg: 30,
    stock: 2000,
    region: 'Harar',
    process: 'natural',
    grade: 'Grade 1',
    image: 'images/Raw-Green-Unprocessed-Coffee-Beans-Whole-5.jpg',
  },
  {
    name: 'Dark Roast Espresso Blend',
    category: 'roasted',
    description: 'Robust espresso-optimised roast for cafés and hotels.',
    pricePerKg: 24.00,
    minOrderKg: 10,
    stock: 1500,
    region: 'Blend',
    process: 'roasted',
    image: 'images/rosted.jpg',
  },
  
  {
    name: 'Sidama Export Beans',
    category: 'green-beans',
    description: 'Highland Arabica beans prepared for international roasting and distribution.',
    pricePerKg: 132.00,
    minOrderKg: 50,
    stock: 4000,
    region: 'Sidama',
    process: 'washed',
    grade: 'Grade 2',
    image: 'images/green-coffee-beans-01.jpg',
  },
  {
    name: 'Harar Natural Coffee',
    category: 'green-beans',
    description: 'Dry-processed Ethiopian coffee with winey notes and bold complexity.',
    pricePerKg: 138.00,
    minOrderKg: 30,
    stock: 2000,
    region: 'Harar',
    process: 'natural',
    grade: 'Grade 1',
    image: 'images/Raw-Green-Unprocessed-Coffee-Beans-Whole-5.jpg',
  },
  {
    name: 'Roasted Espresso Blend',
    category: 'roasted',
    description: 'Dark roasted espresso blend designed for cafés and hotels.',
    pricePerKg: 24.00,
    minOrderKg: 10,
    stock: 1500,
    region: 'Blend',
    process: 'roasted',
    image: 'images/rosted.jpg',
  },
  {
    name: 'Premium Filter Roast',
    category: 'roasted',
    description: 'Medium roast profile preserving Ethiopian floral sweetness.',
    pricePerKg: 22.00,
    minOrderKg: 10,
    stock: 1200,
    region: 'Blend',
    process: 'roasted',
    image: 'images/rosted2.webp',
  },
  {
    name: 'Bulk Commercial Supply',
    category: 'blend',
    description: 'Large-volume coffee supply solution for wholesalers and retailers.',
    pricePerKg: 850.00,
    minOrderKg: 100,
    stock: 20000,
    region: 'National Blend',
    process: 'blend',
    grade: 'Export Grade',
    image: 'images/large package.webp',
  },
  {
    name: 'Washed Process Beans',
    category: 'green-beans',
    description: 'Fully washed Arabica coffee processed for premium export markets.',
    pricePerKg: 140.00,
    minOrderKg: 50,
    stock: 4500,
    region: 'Ethiopia',
    process: 'washed',
    grade: 'Grade 1',
    image: 'images/packeage.jpg',
  },
  {
    name: 'Natural Process Beans',
    category: 'green-beans',
    description: 'Sun-dried natural coffee beans delivering fruity sweetness.',
    pricePerKg: 136.00,
    minOrderKg: 50,
    stock: 4200,
    region: 'Ethiopia',
    process: 'natural',
    grade: 'Grade 2',
    image: 'images/high-angle-view-beans.jpg',
  },
];

const seed = async () => {
  await connectDB();

  // Admin 
  const email    = process.env.ADMIN_EMAIL;
  const existing = await Admin.findByEmail(email);

  if (!existing) {
    await Admin.create({
      name:     process.env.ADMIN_NAME     || 'Super Admin',
      email,
      password: process.env.ADMIN_PASSWORD,
      role:     'superadmin',
    });
    console.log('✅  Superadmin created');
    console.log(`   Email   : ${email}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD}`);
  } else {
    console.log('⚠️  Admin already exists — skipping admin seed');
  }

  
  const toSlug = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').slice(0, 200);

  let created = 0;
  let skipped = 0;
  let imagesBackfilled = 0;
  for (const p of SAMPLE_PRODUCTS) {
    const slug = toSlug(p.name);
    const existing = await Product.findBySlug(slug);

    if (existing) {
      skipped += 1;
      if (!existing.image && p.image) {
        await Product.update(existing.id, { image: p.image });
        imagesBackfilled += 1;
      }
      continue;
    }
    await Product.create(p);
    created += 1;
  }

  if (created > 0) {
    console.log(`✅  ${created} product(s) added to the catalog`);
  }
  if (skipped > 0) {
    console.log(`⚠️  ${skipped} product(s) already existed — skipped`);
  }
  if (imagesBackfilled > 0) {
    console.log(`🖼️   ${imagesBackfilled} existing product(s) had a missing image backfilled`);
  }
  if (created === 0 && skipped === 0) {
    console.log('⚠️  No products defined in SAMPLE_PRODUCTS — nothing to seed');
  }

  await pool.end();
  console.log('\n🎉  Seed complete. You can now start the server.\n');
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
