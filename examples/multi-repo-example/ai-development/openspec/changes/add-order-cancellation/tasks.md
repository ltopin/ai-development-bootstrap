# Tasks: add-order-cancellation

## contracts
- [ ] Add `POST /orders/{id}/cancel` to the OpenAPI file

## api
- [ ] Endpoint and transactional "not shipped" rule
- [ ] Emit `order.status_changed` with `to = cancelled`
- [ ] Tests: allowed, rejected when shipped, race

## worker
- [ ] Cancellation email template and handler branch
- [ ] Tests: idempotent on redelivery

## web
- [ ] Cancel button, confirmation dialog, error state
- [ ] Tests for both outcomes

## validation
- [ ] Build, tests, lint and typecheck pass in `api`, `worker`, `web`
- [ ] Staging scenario from design.md verified

## documentation
- [ ] Update `docs/domains/orders.md` (contracts); merge spec delta into `openspec/specs/orders/spec.md`; archive this change
