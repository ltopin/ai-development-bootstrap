# Orders

## Requirements

### Requirement: Order placement
The system SHALL create an order in status `placed` when a customer submits a valid order.

#### Scenario: Valid order
- **WHEN** a customer submits an order with at least one item
- **THEN** the API returns the order with status `placed`
