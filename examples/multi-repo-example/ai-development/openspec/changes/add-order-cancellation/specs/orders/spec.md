# Orders

## ADDED Requirements

### Requirement: Order cancellation
The system SHALL let a customer cancel their own order while its status is `placed` or `paid`.

#### Scenario: Cancel before shipping
- **WHEN** a customer cancels an order in status `paid`
- **THEN** the order status becomes `cancelled` and a confirmation email is sent

#### Scenario: Cancel after shipping
- **WHEN** a customer cancels an order in status `shipped`
- **THEN** the request is rejected and the status is unchanged
