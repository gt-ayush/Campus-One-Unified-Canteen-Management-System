/**
 * SOURCE OF TRUTH KEYWORDS: api, menu, detail, update, delete, merchant, tenant-isolation
 * WHAT: GET/PATCH/DELETE /api/v1/menu/:id - Fetch, update, or delete a single menu item (merchants own canteen only)
 * WHY: Powers merchant menu management; mutations are restricted to the owning canteen's staff or admins
 * WHERE: src/app/api/v1/menu/[id]/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { updateMenuItemSchema } from "@/lib/validators/schemas";
import { getAuthContext } from "@/lib/auth/server-auth";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/client";

async function findItem(id: string) {
  return prisma.menuItem.findUnique({
    where: { id },
    include: { canteen: { select: { id: true, name: true } } },
  });
}

function canMutate(authCanteenId: string | undefined, role: UserRole, itemCanteenId: string): boolean {
  if (role === UserRole.ADMIN) return true;
  if (role === UserRole.MERCHANT_STAFF && authCanteenId === itemCanteenId) return true;
  return false;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    getAuthContext();
    const { id } = await params;

    const item = await findItem(id);
    if (!item) {
      return NextResponse.json(
        { success: false, error: "Menu item not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("Menu item detail error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = getAuthContext();
    const { id } = await params;

    const item = await findItem(id);
    if (!item) {
      return NextResponse.json(
        { success: false, error: "Menu item not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!canMutate(authContext.canteenId, authContext.role, item.canteenId)) {
      return NextResponse.json(
        { success: false, error: "Cannot modify another canteen's menu", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updateMenuItemSchema.safeParse(body);
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

    const data = validation.data;
    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.isAvailable !== undefined ? { isAvailable: data.isAvailable } : {}),
        ...(data.stockQuantity !== undefined ? { stockQuantity: data.stockQuantity } : {}),
        ...(data.maxPerOrder !== undefined ? { maxPerOrder: data.maxPerOrder } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.dietaryTags !== undefined ? { dietaryTags: data.dietaryTags } : {}),
        ...(data.preparationTime !== undefined ? { preparationTime: data.preparationTime } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Menu item updated successfully",
    });
  } catch (error) {
    console.error("Menu item update error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = getAuthContext();
    const { id } = await params;

    const item = await findItem(id);
    if (!item) {
      return NextResponse.json(
        { success: false, error: "Menu item not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!canMutate(authContext.canteenId, authContext.role, item.canteenId)) {
      return NextResponse.json(
        { success: false, error: "Cannot modify another canteen's menu", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const usedInOrders = await prisma.orderItem.count({ where: { menuItemId: id } });
    if (usedInOrders > 0) {
      await prisma.menuItem.update({ where: { id }, data: { isAvailable: false } });
      return NextResponse.json({
        success: true,
        data: { id, isAvailable: false },
        message: "Item is referenced by past orders, so it was marked unavailable instead of deleted",
      });
    }

    await prisma.menuItem.delete({ where: { id } });
    return NextResponse.json({
      success: true,
      data: { id },
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    console.error("Menu item delete error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
