/**
 * SOURCE OF TRUTH KEYWORDS: api, menu, items, canteen, crud, merchant, admin
 * WHAT: GET/POST /api/v1/menu - Menu item management for canteens
 * WHY: Allows merchants to manage their menu with stock tracking and availability
 * WHERE: src/app/api/v1/menu/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createMenuItemSchema, menuQuerySchema } from "@/lib/validators/schemas";
import { getAuthContext } from "@/lib/auth/server-auth";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  try {
    const authContext = getAuthContext();
    const { searchParams } = new URL(request.url);

    const validation = menuQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid query parameters", errorCode: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { page, limit, canteenId, category, isAvailable, search, sortBy, sortOrder } = validation.data;

    const where: any = {};
    
    if (authContext.role === UserRole.MERCHANT_STAFF) {
      where.canteenId = authContext.canteenId;
    } else if (canteenId) {
      where.canteenId = canteenId;
    }

    if (category) where.category = category;
    if (isAvailable !== undefined) where.isAvailable = isAvailable;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.menuItem.findMany({
        where,
        include: { canteen: { select: { id: true, name: true } } },
        orderBy: { [sortBy || "sortOrder"]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.menuItem.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Menu list error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = getAuthContext();

    if (authContext.role !== UserRole.MERCHANT_STAFF && authContext.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: "Only merchants can create menu items", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createMenuItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          errorCode: "VALIDATION_ERROR",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const canteenId = authContext.role === UserRole.ADMIN 
      ? body.canteenId 
      : authContext.canteenId!;

    if (!canteenId) {
      return NextResponse.json(
        { success: false, error: "Canteen ID required", errorCode: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const item = await prisma.menuItem.create({
      data: {
        name: validation.data.name,
        description: validation.data.description ?? null,
        price: validation.data.price,
        category: validation.data.category,
        isAvailable: validation.data.isAvailable,
        stockQuantity: validation.data.stockQuantity,
        maxPerOrder: validation.data.maxPerOrder,
        imageUrl: validation.data.imageUrl ?? null,
        dietaryTags: validation.data.dietaryTags,
        preparationTime: validation.data.preparationTime,
        sortOrder: validation.data.sortOrder,
        canteenId: canteenId as string,
      },
    });

    return NextResponse.json(
      { success: true, data: item, message: "Menu item created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Menu item creation error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}