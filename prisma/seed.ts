/**
 * SOURCE OF TRUTH KEYWORDS: seed, database, initial-data, admin, development, testing
 * WHAT: Database seed script for development and testing with sample data
 * WHY: Provides consistent baseline data for local development and CI environments
 * WHERE: prisma/seed.ts
 */

import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  const passwordHash = await hash("password123", 12);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@campusfoodpass.com" },
    update: {},
    create: {
      email: "admin@campusfoodpass.com",
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log("✅ Admin user created:", admin.email);

  // Create sample student
  const studentUser = await prisma.user.upsert({
    where: { email: "student@campusfoodpass.com" },
    update: {},
    create: {
      email: "student@campusfoodpass.com",
      passwordHash,
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      studentProfile: {
        create: {
          studentId: "STU2024001",
          fullName: "Alex Johnson",
          phone: "+1555123456",
          campusId: "MAIN_CAMPUS",
          department: "Computer Science",
          yearOfStudy: 3,
          isVerified: true,
          verifiedAt: new Date(),
        },
      },
    },
    include: { studentProfile: true },
  });
  console.log("✅ Student user created:", studentUser.email);

  // Create sample merchant
  const merchantUser = await prisma.user.upsert({
    where: { email: "merchant@campusfoodpass.com" },
    update: {},
    create: {
      email: "merchant@campusfoodpass.com",
      passwordHash,
      role: UserRole.MERCHANT_STAFF,
      status: UserStatus.ACTIVE,
      merchantStaff: {
        create: {
          fullName: "Sarah Chen",
          position: "Manager",
          phone: "+1555987654",
          isActive: true,
          canteen: {
            create: {
              name: "Campus Central Canteen",
              description: "Main campus canteen serving diverse cuisines",
              address: "100 University Ave, Campus Center",
              phone: "+1555111222",
              email: "central@campusfoodpass.com",
              latitude: 40.7128,
              longitude: -74.0060,
              operatingHours: {
                monday: { isOpen: true, openTime: "07:00", closeTime: "20:00" },
                tuesday: { isOpen: true, openTime: "07:00", closeTime: "20:00" },
                wednesday: { isOpen: true, openTime: "07:00", closeTime: "20:00" },
                thursday: { isOpen: true, openTime: "07:00", closeTime: "20:00" },
                friday: { isOpen: true, openTime: "07:00", closeTime: "18:00" },
                saturday: { isOpen: true, openTime: "08:00", closeTime: "16:00" },
                sunday: { isOpen: false, openTime: "00:00", closeTime: "00:00" },
              },
              isApproved: true,
              approvedAt: new Date(),
              approvedBy: admin.id,
              commissionRate: 0.10,
              settlementInfo: {
                bankName: "Campus Federal Credit Union",
                accountNumber: "1234567890",
                accountHolderName: "Campus Central Canteen LLC",
                ifscCode: "CFCU0001234",
                upiId: "centralcanteen@upi",
              },
            },
          },
        },
      },
    },
    include: { merchantStaff: { include: { canteen: true } } },
  });
  console.log("✅ Merchant user created:", merchantUser.email);

  const canteen = merchantUser.merchantStaff!.canteen;
  console.log("✅ Canteen created:", canteen.name);

  // Create menu items
  const menuItems = [
    { name: "Chicken Rice Bowl", description: "Grilled chicken with jasmine rice and vegetables", price: 8.99, category: "Main Course", stockQuantity: 50, preparationTime: 12, dietaryTags: ["halal"] },
    { name: "Vegetarian Stir Fry", description: "Mixed vegetables with tofu and brown rice", price: 7.99, category: "Main Course", stockQuantity: 40, preparationTime: 10, dietaryTags: ["vegetarian", "vegan"] },
    { name: "Beef Burrito", description: "Seasoned beef, beans, cheese, and salsa in tortilla", price: 9.49, category: "Main Course", stockQuantity: 30, preparationTime: 8, dietaryTags: [] },
    { name: "Caesar Salad", description: "Romaine, parmesan, croutons, caesar dressing", price: 6.99, category: "Salads", stockQuantity: 35, preparationTime: 5, dietaryTags: ["vegetarian"] },
    { name: "Greek Yogurt Parfait", description: "Greek yogurt, granola, honey, fresh berries", price: 4.99, category: "Desserts", stockQuantity: 25, preparationTime: 3, dietaryTags: ["vegetarian", "gluten-free"] },
    { name: "Fresh Orange Juice", description: "Freshly squeezed orange juice", price: 3.49, category: "Beverages", stockQuantity: 60, preparationTime: 2, dietaryTags: ["vegan", "gluten-free"] },
    { name: "Coffee (Hot/Iced)", description: "Premium arabica coffee", price: 2.99, category: "Beverages", stockQuantity: 100, preparationTime: 2, dietaryTags: ["vegan"] },
    { name: "Chocolate Chip Cookie", description: "Freshly baked chocolate chip cookie", price: 1.99, category: "Desserts", stockQuantity: 40, preparationTime: 1, dietaryTags: ["vegetarian"] },
  ];

  for (let i = 0; i < menuItems.length; i++) {
    const item = menuItems[i]!;
    await prisma.menuItem.upsert({
      where: { id: `seed-${item.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `seed-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
        canteenId: canteen.id,
        ...item,
        maxPerOrder: 5,
        sortOrder: i,
      },
    });
  }
  console.log("✅ Menu items created:", menuItems.length);

  // Create pickup slots for today and tomorrow
  const now = new Date();
  const slots = [
    { start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 30), end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 15), capacity: 30 },
    { start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 15), end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 0), capacity: 40 },
    { start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 0), end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 45), capacity: 35 },
    { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 30), end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 15), capacity: 30 },
    { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 15), end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 13, 0), capacity: 40 },
    { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 13, 0), end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 13, 45), capacity: 35 },
  ];

  for (const slot of slots) {
    await prisma.pickupSlot.upsert({
      where: {
        canteenId_startTime_endTime: {
          canteenId: canteen.id,
          startTime: slot.start,
          endTime: slot.end,
        },
      },
      update: {},
      create: {
        canteenId: canteen.id,
        startTime: slot.start,
        endTime: slot.end,
        capacityLimit: slot.capacity,
        preparationBuffer: 15,
        isActive: true,
      },
    });
  }
  console.log("✅ Pickup slots created:", slots.length);

  // Create food pass for student
  const studentProfile = studentUser.studentProfile!;
  await prisma.foodPass.upsert({
    where: { id: "seed-semester-pass" },
    update: {},
    create: {
      id: "seed-semester-pass",
      studentId: studentProfile.id,
      packageName: "Semester Meal Plan",
      totalCredits: 20000, // $200 in cents
      remainingCredits: 15000,
      dailyLimit: 5000, // $50 per day
      validFrom: new Date(now.getFullYear(), 0, 1),
      validUntil: new Date(now.getFullYear(), 5, 31),
      status: "ACTIVE",
      purchasePrice: 18000, // $180 with discount
    },
  });
  console.log("✅ Food pass created");

  // Create second canteen for alternatives
  const canteen2 = await prisma.canteen.upsert({
    where: { id: "seed-east-canteen" },
    update: {},
    create: {
      id: "seed-east-canteen",
      name: "East Campus Kitchen",
      description: "East campus canteen with Asian fusion menu",
      address: "200 East Campus Drive",
      phone: "+1555333444",
      email: "east@campusfoodpass.com",
      latitude: 40.7138,
      longitude: -73.9960,
      operatingHours: {
        monday: { isOpen: true, openTime: "07:30", closeTime: "19:30" },
        tuesday: { isOpen: true, openTime: "07:30", closeTime: "19:30" },
        wednesday: { isOpen: true, openTime: "07:30", closeTime: "19:30" },
        thursday: { isOpen: true, openTime: "07:30", closeTime: "19:30" },
        friday: { isOpen: true, openTime: "07:30", closeTime: "17:30" },
        saturday: { isOpen: false, openTime: "00:00", closeTime: "00:00" },
        sunday: { isOpen: false, openTime: "00:00", closeTime: "00:00" },
      },
      isApproved: true,
      approvedAt: new Date(),
      approvedBy: admin.id,
      commissionRate: 0.10,
      settlementInfo: {
        bankName: "East Campus Bank",
        accountNumber: "0987654321",
        accountHolderName: "East Campus Kitchen Inc",
        ifscCode: "ECBK0004321",
      },
    },
  });
  console.log("✅ Second canteen created:", canteen2.name);

  // Create menu items for second canteen (overlapping items for alternatives)
  const eastMenuItems = [
    { name: "Chicken Rice Bowl", description: "Asian-style chicken rice with soy glaze", price: 9.49, category: "Main Course", stockQuantity: 45, preparationTime: 10, dietaryTags: ["halal"] },
    { name: "Vegetable Fried Rice", description: "Wok-fried rice with mixed vegetables", price: 7.49, category: "Main Course", stockQuantity: 50, preparationTime: 8, dietaryTags: ["vegetarian", "vegan"] },
    { name: "Beef Noodle Soup", description: "Rich beef broth with hand-pulled noodles", price: 10.99, category: "Main Course", stockQuantity: 25, preparationTime: 15, dietaryTags: [] },
    { name: "Spring Rolls (4pc)", description: "Crispy vegetable spring rolls with dipping sauce", price: 4.99, category: "Appetizers", stockQuantity: 40, preparationTime: 5, dietaryTags: ["vegetarian", "vegan"] },
  ];

  for (let i = 0; i < eastMenuItems.length; i++) {
    const item = eastMenuItems[i]!;
    await prisma.menuItem.upsert({
      where: { id: `seed-east-${item.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `seed-east-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
        canteenId: canteen2.id,
        ...item,
        maxPerOrder: 5,
        sortOrder: i,
      },
    });
  }
  console.log("✅ East canteen menu items created:", eastMenuItems.length);

  // Create pickup slots for second canteen
  for (const slot of slots) {
    await prisma.pickupSlot.upsert({
      where: {
        canteenId_startTime_endTime: {
          canteenId: canteen2.id,
          startTime: slot.start,
          endTime: slot.end,
        },
      },
      update: {},
      create: {
        canteenId: canteen2.id,
        startTime: slot.start,
        endTime: slot.end,
        capacityLimit: slot.capacity,
        preparationBuffer: 15,
        isActive: true,
      },
    });
  }
  console.log("✅ East canteen pickup slots created");

  console.log("\n🎉 Database seed completed successfully!");
  console.log("\n📋 Test Credentials:");
  console.log("  Admin:    admin@campusfoodpass.com / password123");
  console.log("  Student:  student@campusfoodpass.com / password123");
  console.log("  Merchant: merchant@campusfoodpass.com / password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });