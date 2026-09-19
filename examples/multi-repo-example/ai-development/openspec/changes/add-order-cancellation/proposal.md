# add-order-cancellation: Let customers cancel orders

## Problem

Customers who ordered by mistake must contact the shop; operators cancel manually.

## Goal

A customer can cancel their own order until it ships, and receives a confirmation email.

## Scope

- Cancel action for customers on the order page.
- Cancellation rule and persistence.
- Notification email on cancellation.

## Out of scope

- Refunds (payment is a separate domain).
- Operator-initiated cancellation.

## Repositories potentially affected

| Repository | Why |
|---|---|
| `api` | new endpoint, rule "not after shipped", emits event |
| `web` | cancel button and error handling |
| `worker` | new email template for `cancelled` |

Checked and **not** affected: none other in this workspace.
