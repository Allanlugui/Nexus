# Security Specification - Nexus ERP

## Data Invariants
1. **User Identity**: A user's profile can only be modified by the user themselves or a system admin.
2. **Access Control**: Most ERP data (Sales, Approvals, Budgets) should be restricted to authenticated users.
3. **Hierarchical Approvals**: Approval requests follow a status flow that can only be advanced by users with appropriate roles/positions.
4. **Virtual File System**: Files and folders should be accessible by their owners or according to organizational hierarchy (though for simplicity in this ruleset, we'll start with authenticated access and refine).
5. **PII Safety**: User emails and sensitive data are protected.

## The "Dirty Dozen" Payloads (Targeting erp_users)
1. **Identity Spoofing**: Attempt to create a user with a different UID.
2. **Privilege Escalation**: Attempt to set `isSystemAdmin: true` on a non-admin user.
3. **Ghost Fields**: Attempt to add `maliciousField: "payload"` to a user document.
4. **Unauthorized Deletion**: Attempt to delete another user's profile.
5. **Schema Violation**: Attempt to set `email` as a number.
6. **Large ID Poisoning**: Attempt to use a 2MB string as a document ID.
7. **Status Jump**: Attempt to set a user's status directly to "DISMISSED" by a non-admin.
8. **PII Leak**: Attempt to read all users' private data (if we had private subcollections).
9. **Timestamp Fraud**: Attempt to set `createdAt` to a past date.
10. **Immutable Field Change**: Attempt to change `id` after creation.
11. **Orphaned Record**: Attempt to create a message without a valid senderId.
12. **Batch Bypass**: Attempt to update a sale without proper authorization.

## Test Runner (firestore.rules.test.ts)
```typescript
// Proposed test cases for the Red Team Audit
// These would be implemented in a real testing environment.
```
