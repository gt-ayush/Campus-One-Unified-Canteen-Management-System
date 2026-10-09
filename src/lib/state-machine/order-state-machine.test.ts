/**
 * SOURCE OF TRUTH KEYWORDS: test, state-machine, order-lifecycle, transitions, guards, unit-test
 * WHAT: Unit tests for OrderStateMachine validating all transitions and permissions
 * WHY: Ensures state machine correctly enforces business rules and prevents invalid transitions
 * WHERE: src/lib/state-machine/order-state-machine.test.ts
 */

import { OrderStateMachine } from "./order-state-machine";
import { OrderStatus, UserRole, AuditAction } from "@/lib/types/domain";

describe("OrderStateMachine", () => {
  let stateMachine: OrderStateMachine;

  beforeEach(() => {
    stateMachine = new OrderStateMachine();
  });

  describe("Student Permissions", () => {
    it("allows student to cancel PENDING order", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.PENDING,
        OrderStatus.CANCELLED,
        { actorId: "student-1", actorRole: UserRole.STUDENT, orderId: "order-1" }
      );
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(OrderStatus.CANCELLED);
      expect(result.auditData?.action).toBe(AuditAction.ORDER_CANCELLED);
    });

    it("allows student to cancel CONFIRMED order", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
        { actorId: "student-1", actorRole: UserRole.STUDENT, orderId: "order-1" }
      );
      expect(result.success).toBe(true);
    });

    it("blocks student from cancelling PREPARING order", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.PREPARING,
        OrderStatus.CANCELLED,
        { actorId: "student-1", actorRole: UserRole.STUDENT, orderId: "order-1" }
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("can only cancel orders in PENDING or CONFIRMED");
    });

    it("blocks student from cancelling READY order", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.READY,
        OrderStatus.CANCELLED,
        { actorId: "student-1", actorRole: UserRole.STUDENT, orderId: "order-1" }
      );
      expect(result.success).toBe(false);
    });

    it("blocks student from transitioning to any status except CANCELLED", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        { actorId: "student-1", actorRole: UserRole.STUDENT, orderId: "order-1" }
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Students can only transition orders to CANCELLED");
    });

    it("blocks student from acting on COLLECTED order", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.COLLECTED,
        OrderStatus.CANCELLED,
        { actorId: "student-1", actorRole: UserRole.STUDENT, orderId: "order-1" }
      );
      expect(result.success).toBe(false);
    });
  });

  describe("Merchant Staff Permissions", () => {
    it("allows merchant to confirm PENDING order", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        { actorId: "merchant-1", actorRole: UserRole.MERCHANT_STAFF, orderId: "order-1", canteenId: "canteen-1" }
      );
      expect(result.success).toBe(true);
      expect(result.auditData?.action).toBe(AuditAction.ORDER_CONFIRMED);
    });

    it("allows merchant to reject PENDING order", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.PENDING,
        OrderStatus.REJECTED,
        { actorId: "merchant-1", actorRole: UserRole.MERCHANT_STAFF, orderId: "order-1", canteenId: "canteen-1" }
      );
      expect(result.success).toBe(true);
      expect(result.auditData?.action).toBe(AuditAction.ORDER_REJECTED);
    });

    it("allows merchant to start preparing CONFIRMED order", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        { actorId: "merchant-1", actorRole: UserRole.MERCHANT_STAFF, orderId: "order-1", canteenId: "canteen-1" }
      );
      expect(result.success).toBe(true);
      expect(result.auditData?.action).toBe(AuditAction.ORDER_PREPARING);
      expect(result.auditData?.metadata.warningFlag).toBe("PREPARING_TRANSITION_MONITORED");
    });

    it("allows merchant to mark PREPARING order as READY", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.PREPARING,
        OrderStatus.READY,
        { actorId: "merchant-1", actorRole: UserRole.MERCHANT_STAFF, orderId: "order-1", canteenId: "canteen-1" }
      );
      expect(result.success).toBe(true);
      expect(result.auditData?.action).toBe(AuditAction.ORDER_READY);
    });

    it("allows merchant to reject CONFIRMED order", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.CONFIRMED,
        OrderStatus.REJECTED,
        { actorId: "merchant-1", actorRole: UserRole.MERCHANT_STAFF, orderId: "order-1", canteenId: "canteen-1" }
      );
      expect(result.success).toBe(true);
    });

    it("allows merchant to reject PREPARING order", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.PREPARING,
        OrderStatus.REJECTED,
        { actorId: "merchant-1", actorRole: UserRole.MERCHANT_STAFF, orderId: "order-1", canteenId: "canteen-1" }
      );
      expect(result.success).toBe(true);
    });

    it("allows merchant to collect READY order", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.READY,
        OrderStatus.COLLECTED,
        { actorId: "merchant-1", actorRole: UserRole.MERCHANT_STAFF, orderId: "order-1", canteenId: "canteen-1" }
      );
      expect(result.success).toBe(true);
      expect(result.auditData?.action).toBe(AuditAction.ORDER_COLLECTED);
    });

    it("blocks merchant from acting on COLLECTED order", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.COLLECTED,
        OrderStatus.READY,
        { actorId: "merchant-1", actorRole: UserRole.MERCHANT_STAFF, orderId: "order-1", canteenId: "canteen-1" }
      );
      expect(result.success).toBe(false);
    });

    it("blocks merchant from acting on CANCELLED order", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.CANCELLED,
        OrderStatus.CONFIRMED,
        { actorId: "merchant-1", actorRole: UserRole.MERCHANT_STAFF, orderId: "order-1", canteenId: "canteen-1" }
      );
      expect(result.success).toBe(false);
    });
  });

  describe("Admin Permissions", () => {
    it("allows admin all valid transitions", () => {
      const validTransitions = [
        [OrderStatus.PENDING, OrderStatus.CONFIRMED],
        [OrderStatus.PENDING, OrderStatus.CANCELLED],
        [OrderStatus.PENDING, OrderStatus.REJECTED],
        [OrderStatus.CONFIRMED, OrderStatus.PREPARING],
        [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
        [OrderStatus.CONFIRMED, OrderStatus.REJECTED],
        [OrderStatus.PREPARING, OrderStatus.READY],
        [OrderStatus.PREPARING, OrderStatus.REJECTED],
        [OrderStatus.READY, OrderStatus.COLLECTED],
        [OrderStatus.READY, OrderStatus.REJECTED],
      ];

      for (const [from, to] of validTransitions) {
        const result = stateMachine.validateTransition(from, to, {
          actorId: "admin-1",
          actorRole: UserRole.ADMIN,
          orderId: "order-1",
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Invalid Transitions", () => {
    it("blocks PENDING -> PREPARING (must go through CONFIRMED)", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.PENDING,
        OrderStatus.PREPARING,
        { actorId: "merchant-1", actorRole: UserRole.MERCHANT_STAFF, orderId: "order-1", canteenId: "canteen-1" }
      );
      expect(result.success).toBe(false);
    });

    it("blocks CONFIRMED -> COLLECTED (must go through PREPARING, READY)", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.CONFIRMED,
        OrderStatus.COLLECTED,
        { actorId: "merchant-1", actorRole: UserRole.MERCHANT_STAFF, orderId: "order-1", canteenId: "canteen-1" }
      );
      expect(result.success).toBe(false);
    });

    it("blocks PREPARING -> CANCELLED (merchant cannot cancel)", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.PREPARING,
        OrderStatus.CANCELLED,
        { actorId: "merchant-1", actorRole: UserRole.MERCHANT_STAFF, orderId: "order-1", canteenId: "canteen-1" }
      );
      expect(result.success).toBe(false);
    });

    it("blocks READY -> CANCELLED", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.READY,
        OrderStatus.CANCELLED,
        { actorId: "student-1", actorRole: UserRole.STUDENT, orderId: "order-1" }
      );
      expect(result.success).toBe(false);
    });

    it("blocks transitions from terminal states", () => {
      const terminalStates = [OrderStatus.COLLECTED, OrderStatus.CANCELLED, OrderStatus.REJECTED];
      for (const state of terminalStates) {
        const result = stateMachine.validateTransition(state, OrderStatus.CONFIRMED, {
          actorId: "admin-1",
          actorRole: UserRole.ADMIN,
          orderId: "order-1",
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe("Helper Methods", () => {
    it("isStudentCancellable returns true for PENDING and CONFIRMED", () => {
      expect(stateMachine.isStudentCancellable(OrderStatus.PENDING)).toBe(true);
      expect(stateMachine.isStudentCancellable(OrderStatus.CONFIRMED)).toBe(true);
    });

    it("isStudentCancellable returns false for other states", () => {
      expect(stateMachine.isStudentCancellable(OrderStatus.PREPARING)).toBe(false);
      expect(stateMachine.isStudentCancellable(OrderStatus.READY)).toBe(false);
      expect(stateMachine.isStudentCancellable(OrderStatus.COLLECTED)).toBe(false);
      expect(stateMachine.isStudentCancellable(OrderStatus.CANCELLED)).toBe(false);
      expect(stateMachine.isStudentCancellable(OrderStatus.REJECTED)).toBe(false);
    });

    it("isMerchantActionable returns true for actionable states", () => {
      expect(stateMachine.isMerchantActionable(OrderStatus.PENDING)).toBe(true);
      expect(stateMachine.isMerchantActionable(OrderStatus.CONFIRMED)).toBe(true);
      expect(stateMachine.isMerchantActionable(OrderStatus.PREPARING)).toBe(true);
      expect(stateMachine.isMerchantActionable(OrderStatus.READY)).toBe(true);
    });

    it("isMerchantActionable returns false for terminal states", () => {
      expect(stateMachine.isMerchantActionable(OrderStatus.COLLECTED)).toBe(false);
      expect(stateMachine.isMerchantActionable(OrderStatus.CANCELLED)).toBe(false);
      expect(stateMachine.isMerchantActionable(OrderStatus.REJECTED)).toBe(false);
    });

    it("isTerminalStatus identifies terminal states", () => {
      expect(stateMachine.isTerminalStatus(OrderStatus.COLLECTED)).toBe(true);
      expect(stateMachine.isTerminalStatus(OrderStatus.CANCELLED)).toBe(true);
      expect(stateMachine.isTerminalStatus(OrderStatus.REJECTED)).toBe(true);
      expect(stateMachine.isTerminalStatus(OrderStatus.PENDING)).toBe(false);
      expect(stateMachine.isTerminalStatus(OrderStatus.CONFIRMED)).toBe(false);
    });

    it("getAllowedTransitions returns correct transitions for role", () => {
      const studentTransitions = stateMachine.getAllowedTransitions(OrderStatus.PENDING, UserRole.STUDENT);
      expect(studentTransitions).toEqual([OrderStatus.CANCELLED]);

      const merchantTransitions = stateMachine.getAllowedTransitions(OrderStatus.PENDING, UserRole.MERCHANT_STAFF);
      expect(merchantTransitions).toContain(OrderStatus.CONFIRMED);
      expect(merchantTransitions).toContain(OrderStatus.REJECTED);
      expect(merchantTransitions).not.toContain(OrderStatus.CANCELLED);
    });
  });

  describe("PREPARING Transition Monitoring", () => {
    it("flags PREPARING transition for anti-fraud monitoring", () => {
      const result = stateMachine.validateTransition(
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        { actorId: "merchant-1", actorRole: UserRole.MERCHANT_STAFF, orderId: "order-1", canteenId: "canteen-1" }
      );
      expect(result.success).toBe(true);
      expect(result.auditData?.metadata.warningFlag).toBe("PREPARING_TRANSITION_MONITORED");
      expect(result.auditData?.metadata.preparingMarkedAt).toBeDefined();
    });
  });
});