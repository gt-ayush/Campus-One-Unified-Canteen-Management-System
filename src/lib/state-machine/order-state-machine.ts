/**
 * SOURCE OF TRUTH KEYWORDS: state-machine, order-lifecycle, transitions, guards, permissions, concurrency
 * WHAT: Deterministic order state machine with server-enforced transition guards and RBAC permissions
 * WHY: Ensures only valid status transitions occur with proper authorization, preventing client-side manipulation
 * WHERE: src/lib/state-machine/order-state-machine.ts
 */

import "server-only";
import { OrderStatus, UserRole, AuditAction } from "@/lib/types/domain";

export interface StateTransition {
  from: OrderStatus;
  to: OrderStatus;
  allowedRoles: UserRole[];
  requiresAudit: boolean;
  auditAction: AuditAction;
}

export interface TransitionContext {
  actorId: string;
  actorRole: UserRole;
  canteenId?: string;
  orderId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface TransitionResult {
  success: boolean;
  newStatus?: OrderStatus;
  error?: string;
  auditData?: {
    action: AuditAction;
    previousState: OrderStatus;
    newState: OrderStatus;
    metadata: Record<string, unknown>;
  };
}

const TRANSITIONS: StateTransition[] = [
  {
    from: OrderStatus.PENDING,
    to: OrderStatus.CONFIRMED,
    allowedRoles: [UserRole.MERCHANT_STAFF, UserRole.ADMIN],
    requiresAudit: true,
    auditAction: AuditAction.ORDER_CONFIRMED,
  },
  {
    from: OrderStatus.PENDING,
    to: OrderStatus.CANCELLED,
    allowedRoles: [UserRole.STUDENT, UserRole.ADMIN],
    requiresAudit: true,
    auditAction: AuditAction.ORDER_CANCELLED,
  },
  {
    from: OrderStatus.PENDING,
    to: OrderStatus.REJECTED,
    allowedRoles: [UserRole.MERCHANT_STAFF, UserRole.ADMIN],
    requiresAudit: true,
    auditAction: AuditAction.ORDER_REJECTED,
  },
  {
    from: OrderStatus.CONFIRMED,
    to: OrderStatus.PREPARING,
    allowedRoles: [UserRole.MERCHANT_STAFF, UserRole.ADMIN],
    requiresAudit: true,
    auditAction: AuditAction.ORDER_PREPARING,
  },
  {
    from: OrderStatus.CONFIRMED,
    to: OrderStatus.CANCELLED,
    allowedRoles: [UserRole.STUDENT, UserRole.ADMIN],
    requiresAudit: true,
    auditAction: AuditAction.ORDER_CANCELLED,
  },
  {
    from: OrderStatus.CONFIRMED,
    to: OrderStatus.REJECTED,
    allowedRoles: [UserRole.MERCHANT_STAFF, UserRole.ADMIN],
    requiresAudit: true,
    auditAction: AuditAction.ORDER_REJECTED,
  },
  {
    from: OrderStatus.PREPARING,
    to: OrderStatus.READY,
    allowedRoles: [UserRole.MERCHANT_STAFF, UserRole.ADMIN],
    requiresAudit: true,
    auditAction: AuditAction.ORDER_READY,
  },
  {
    from: OrderStatus.PREPARING,
    to: OrderStatus.REJECTED,
    allowedRoles: [UserRole.MERCHANT_STAFF, UserRole.ADMIN],
    requiresAudit: true,
    auditAction: AuditAction.ORDER_REJECTED,
  },
  {
    from: OrderStatus.READY,
    to: OrderStatus.COLLECTED,
    allowedRoles: [UserRole.MERCHANT_STAFF, UserRole.ADMIN],
    requiresAudit: true,
    auditAction: AuditAction.ORDER_COLLECTED,
  },
  {
    from: OrderStatus.READY,
    to: OrderStatus.REJECTED,
    allowedRoles: [UserRole.MERCHANT_STAFF, UserRole.ADMIN],
    requiresAudit: true,
    auditAction: AuditAction.ORDER_REJECTED,
  },
];

const STUDENT_CANCELLABLE_STATUSES = new Set([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
]);

const MERCHANT_ACTIONABLE_STATUSES = new Set([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
]);

export class OrderStateMachine {
  private transitions: Map<string, StateTransition[]>;

  constructor() {
    this.transitions = new Map();
    for (const transition of TRANSITIONS) {
      const key = `${transition.from}->${transition.to}`;
      if (!this.transitions.has(key)) {
        this.transitions.set(key, []);
      }
      this.transitions.get(key)!.push(transition);
    }
  }

  canTransition(
    from: OrderStatus,
    to: OrderStatus,
    actorRole: UserRole
  ): { allowed: boolean; transition?: StateTransition } {
    const key = `${from}->${to}`;
    const transitions = this.transitions.get(key);

    if (!transitions || transitions.length === 0) {
      return { allowed: false };
    }

    const transition = transitions.find((t) => t.allowedRoles.includes(actorRole));
    return {
      allowed: !!transition,
      transition,
    };
  }

  validateTransition(
    currentStatus: OrderStatus,
    targetStatus: OrderStatus,
    context: TransitionContext
  ): TransitionResult {
    const { allowed, transition } = this.canTransition(
      currentStatus,
      targetStatus,
      context.actorRole
    );

    if (!allowed || !transition) {
      return {
        success: false,
        error: `Invalid status transition from ${currentStatus} to ${targetStatus} for role ${context.actorRole}`,
      };
    }

    if (context.actorRole === UserRole.MERCHANT_STAFF && context.canteenId) {
      // Additional validation: merchant can only act on orders from their canteen
      // This is enforced at the service layer via assertCanteenAccess
    }

    if (context.actorRole === UserRole.STUDENT) {
      if (!STUDENT_CANCELLABLE_STATUSES.has(currentStatus)) {
        return {
          success: false,
          error: `Students can only cancel orders in PENDING or CONFIRMED status. Current status: ${currentStatus}`,
        };
      }
      if (targetStatus !== OrderStatus.CANCELLED) {
        return {
          success: false,
          error: `Students can only transition orders to CANCELLED status`,
        };
      }
    }

    if (context.actorRole === UserRole.MERCHANT_STAFF) {
      if (!MERCHANT_ACTIONABLE_STATUSES.has(currentStatus)) {
        return {
          success: false,
          error: `Merchants cannot act on orders in ${currentStatus} status`,
        };
      }
    }

    const auditMetadata: Record<string, unknown> = {
      reason: context.reason,
      actorId: context.actorId,
      actorRole: context.actorRole,
      ...context.metadata,
    };

    if (transition.auditAction === AuditAction.MERCHANT_PREPARING_MARKED) {
      auditMetadata.preparingMarkedAt = new Date().toISOString();
      auditMetadata.warningFlag = "PREPARING_TRANSITION_MONITORED";
    }

    return {
      success: true,
      newStatus: targetStatus,
      auditData: {
        action: transition.auditAction,
        previousState: currentStatus,
        newState: targetStatus,
        metadata: auditMetadata,
      },
    };
  }

  getAllowedTransitions(
    currentStatus: OrderStatus,
    actorRole: UserRole
  ): OrderStatus[] {
    const allowed: OrderStatus[] = [];
    for (const transition of TRANSITIONS) {
      if (
        transition.from === currentStatus &&
        transition.allowedRoles.includes(actorRole)
      ) {
        allowed.push(transition.to);
      }
    }
    return allowed;
  }

  isStudentCancellable(status: OrderStatus): boolean {
    return STUDENT_CANCELLABLE_STATUSES.has(status);
  }

  isMerchantActionable(status: OrderStatus): boolean {
    return MERCHANT_ACTIONABLE_STATUSES.has(status);
  }

  isTerminalStatus(status: OrderStatus): boolean {
    return [
      OrderStatus.COLLECTED,
      OrderStatus.CANCELLED,
      OrderStatus.REJECTED,
    ].includes(status);
  }

  getNextStatusesForRole(status: OrderStatus, role: UserRole): OrderStatus[] {
    return this.getAllowedTransitions(status, role);
  }
}

export const orderStateMachine = new OrderStateMachine();