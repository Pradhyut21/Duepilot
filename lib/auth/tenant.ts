import { eq, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { getDb } from '../db/client';
import { businessMemberships, businesses } from '../db/schema';

export interface BusinessContext {
  businessId: string;
  role: string;
  businessName: string;
  isDemo: boolean;
}

/**
 * Resolves the user's first business membership. Returns null when the user
 * belongs to no business. Every business-scoped query must derive its
 * business id from this context (or from a validated session), never from
 * client input.
 */
export async function requireBusinessContext(
  userId: string,
): Promise<BusinessContext | null> {
  const rows = await getDb()
    .select({
      businessId: businesses.id,
      role: businessMemberships.role,
      businessName: businesses.name,
      isDemo: businesses.isDemo,
    })
    .from(businessMemberships)
    .innerJoin(businesses, eq(businesses.id, businessMemberships.businessId))
    .where(eq(businessMemberships.userId, userId))
    .orderBy(businesses.createdAt)
    .limit(1);

  return rows[0] ?? null;
}

/** Returns the `column = businessId` clause used to scope a query to one tenant. */
export function scopeByBusiness(column: AnyPgColumn, businessId: string): SQL {
  return eq(column, businessId);
}
