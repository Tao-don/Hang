# Security Specification - BNDShop Pro

## 1. Data Invariants
- **Consistency**: An order cannot reference a non-existent customer (during creation).
- **Integrity**: Sales totals and product quantities must be non-negative.
- **Immutability**: `createdAt` and `ownerId` cannot be changed after creation.
- **Identity**: Users can only modify their own profile information.
- **Role-Based Access**: Specialized actions (like deleting orders or managing inventory) might be restricted to Admins.
- **Temporal**: All timestamps must be server-generated (`request.time`).

## 2. The "Dirty Dozen" Payloads (Targets for PERMISSION_DENIED)

1.  **Identity Spoofing**: Attempt to create an order with a different `ownerId`.
2.  **Shadow Update**: Attempt to update an order with a hidden `isVerified: true` field.
3.  **State Shortcut**: Attempt to change an order status from "Đang giao" to "Đã Hủy" bypassing logic.
4.  **Resource Poisoning**: Attempt to create a customer with a 2MB note string.
5.  **ID Poisoning**: Attempt to create a document with ID `../../secrets`.
6.  **Admin Escalation**: A non-admin user trying to mark themselves as `role: 'admin'`.
7.  **PII Leak**: A user trying to list all emails in the `users` collection.
8.  **Ghost Field**: Adding `discount: 100` to a product in inventory (which shouldn't have discount field).
9.  **Negative Quantity**: Setting `qty: -50` in an order.
10. **Timestamp Fraud**: Providing a manual `createdAt` string instead of `serverTimestamp()`.
11. **Relational Orphan**: Creating an order for a `projectId` that doesn't exist.
12. **Unauthorized Deletion**: An employee trying to delete an old completed order.

## 3. Test Cases (Summary)
- **C1: Users** - Owner can Read/Write own. Others cannot.
- **C2: Orders** - Authenticated users can Create/Read/Update. Only Admins can Delete.
- **C3: Customers** - Authenticated users can Create/Read/Update.
- **C4: Inventory** - Authenticated users can Read. Admins can Write/Update.
- **C5: CV Data** - Restricted to Admins.
