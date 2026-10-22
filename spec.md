# Home Food Ordering

## 1. Purpose

Home Food Ordering is a private household food-ordering system operated through a Discord bot.

Users interact with the system exclusively through Discord. They can select a predefined meal from the available meal catalogue or submit a completely free-form custom order.

The system records orders and immediately notifies the household administrator when an order is placed.

This is a private household system, not a restaurant, delivery, payment, inventory, or marketplace application.

---

## 2. Core Principles

The implementation MUST follow these principles:

1. **Discord is the primary user interface.**
2. **The system MUST NOT use AI, NLP, LLMs, intent detection, or automatic interpretation of user input.**
3. **Custom order text MUST be stored verbatim.**
4. **There is no pricing or payment functionality.**
5. **There is no inventory management.**
6. **There are no ordering windows or scheduled menus.**
7. **Any meal may be ordered at any time.**
8. **The database is the source of truth for orders.**
9. **Notifications are secondary delivery mechanisms and MUST NOT determine whether an order exists.**
10. The application is intended for a single private household and SHOULD favor simplicity over generalized multi-tenant architecture.

---

# 3. User Experience

## 3.1 Entry Point

There is exactly one user-facing slash command:

```text
/menu
```

`/menu` opens the application's main Discord UI.

The bot SHOULD use Discord components such as:

- buttons
- select menus
- modals
- embeds

The user SHOULD NOT need to know internal IDs or type command-like syntax.

---

## 3.2 Main Menu

The main menu should provide the ordering functionality.

Conceptually:

```text
🍽️ HOME KITCHEN

What would you like to do?

[🍽️ Order]
[📋 My Orders]
```

Administrative functionality may be exposed from the same `/menu` entry point to authorized users.

There MUST NOT be separate `/order`, `/orders`, or `/admin` commands.

---

# 4. Ordering

## 4.1 Order Selection

Selecting `Order` presents a Discord select menu containing the currently available predefined meals.

Example:

```text
🍽️ ORDER

Select a meal:

[ Chicken Curry          ▼ ]
```

The select menu MUST also contain a special:

```text
✍️ Custom
```

option.

---

## 4.2 Predefined Meal

When a user selects a predefined meal, the system creates an order for the selected meal.

A predefined meal is a reference to an entry in the meal catalogue.

The system MUST NOT calculate or display a price.

There is no quantity/pricing/cart requirement unless explicitly added to the specification later.

The interaction should provide an explicit final action:

```text
🍛 Chicken Curry

[Order]
[← Back]
```

Clicking `Order` creates the order.

---

# 5. Custom Orders

## 5.1 Custom Selection

Selecting `✍️ Custom` opens a Discord modal.

The modal contains one free-text field.

Example:

```text
✍️ CUSTOM ORDER

What would you like?

┌────────────────────────────────────┐
│ 2 chicken curry, one without       │
│ onions and an omurice              │
└────────────────────────────────────┘

[Cancel] [Order]
```

---

## 5.2 Verbatim Requirement

The custom-order field is **not interpreted**.

The application MUST NOT:

- parse the text
- normalize the text
- extract meals
- infer quantities
- detect intent
- identify entities
- correct spelling
- translate the text
- call an LLM
- call an NLP service
- call an AI service
- transform the user's wording

If the user enters:

```text
2 chicken curry, one without onions and an omurice
```

the stored custom order text MUST be exactly that string.

The custom text is the ordered meal/request.

---

# 6. Order Creation

When the user presses `Order`:

1. Validate that the submitted order is structurally valid.
2. Create the order in the database.
3. Persist the user who placed the order.
4. Persist either:
   - the selected predefined meal, or
   - the verbatim custom text.
5. Commit the transaction.
6. After successful persistence, send notifications to the administrator.
7. Confirm the order to the user.

The notification process MUST NOT be part of the transaction determining whether the order exists.

If notification delivery fails, the order MUST remain successfully stored.

---

# 7. Order Data Model

The domain should remain intentionally small.

At minimum, the system needs the following concepts.

## 7.1 User

Represents a Discord user who can place orders.

Relevant information includes:

- internal database identifier
- Discord user ID
- display information as appropriate

Discord user IDs SHOULD be treated as stable external identifiers.

---

## 7.2 Meal

Represents a predefined meal available for ordering.

At minimum:

- identifier
- name
- availability/enabled state

A meal represents something the household kitchen is willing to prepare.

It does NOT represent inventory.

---

## 7.3 Order

Represents one submitted order.

At minimum:

- identifier
- ordering user
- creation timestamp
- order type/content
- status

An order MUST contain exactly one of:

### Predefined order

A reference to a predefined meal.

### Custom order

A verbatim text value supplied by the user.

Conceptually:

```text
Order
 ├── user
 ├── created_at
 ├── status
 └── content
      ├── predefined meal reference
      └── custom text
```

The implementation MAY represent these internally using separate nullable fields, a discriminator plus payload, or another suitable relational design, provided the domain semantics remain unambiguous.

---

# 8. Order Status

Orders should have a simple lifecycle.

Initial state:

```text
ORDERED
```

The kitchen/admin may subsequently move an order through preparation states.

The intended lifecycle is:

```text
ORDERED
   ↓
PREPARING
   ↓
READY
   ↓
COMPLETED
```

Cancellation may terminate an order:

```text
ORDERED ──────→ CANCELLED
PREPARING ────→ CANCELLED
```

Exact cancellation rules may be refined during implementation.

The system SHOULD reject invalid state transitions rather than relying on the Discord UI alone to prevent them.

---

# 9. Administrator

This is a private household deployment.

The Discord user ID of the administrator MAY therefore be configured as a single known value.

For the initial implementation, it is acceptable for the administrator Discord user ID to be hardcoded/configured as an application setting.

There is no requirement for:

- administrator registration
- administrator discovery
- multi-tenant administration
- an administrator account system

Administrative Discord interactions MUST be restricted to the configured administrator.

---

# 10. New Order Notifications

Every successfully created order MUST trigger two notification attempts:

1. an ntfy.sh notification
2. a Discord private message (DM) to the configured administrator

Conceptually:

```text
Order committed
      │
      ├──→ ntfy.sh
      │
      └──→ Discord DM → Administrator
```

The two notifications are independent.

A failure to deliver one notification MUST NOT invalidate or delete the order.

---

## 10.1 Discord DM

The administrator receives a private Discord message containing the newly created order.

For a predefined meal:

```text
🍽️ New Order

From: Mark

Chicken Curry

Order #1042
```

For a custom order:

```text
🍽️ New Order

From: Mark

Custom order:
2 chicken curry, one without onions and an omurice

Order #1043
```

The exact visual formatting may use Discord embeds/components.

---

## 10.2 ntfy.sh

The system sends a push notification through ntfy.sh when an order is successfully created.

The notification SHOULD contain enough information for the administrator to recognize the order without opening Discord.

For example:

```text
New food order from Mark

Chicken Curry

Order #1042
```

For custom orders:

```text
New food order from Mark

Custom:
2 chicken curry, one without onions and an omurice

Order #1043
```

The ntfy topic and credentials, if required, MUST be application configuration/secrets rather than user-entered data.

---

# 11. Order Confirmation

After successful order creation, the user receives a Discord confirmation.

Example:

```text
✅ Order placed

Chicken Curry

Order #1042
Status: ORDERED
```

For a custom order:

```text
✅ Order placed

Custom order:

2 chicken curry, one without onions and an omurice

Order #1043
Status: ORDERED
```

The confirmation MUST represent the order actually persisted by the backend.

---

# 12. Order History

Users should be able to access their previous orders through `/menu`.

Conceptually:

```text
📋 MY ORDERS

#1043 · ORDERED
Custom:
2 chicken curry, one without onions and an omurice

#1042 · COMPLETED
Chicken Curry

[View Order]
[← Back]
```

A user MUST only be able to view their own orders through the customer interface.

The administrator may have access to all orders through the administrative/kitchen interface.

---

# 13. Kitchen / Administrator View

The administrator needs a practical view of outstanding orders.

The kitchen view should prioritize **what needs to be prepared**, rather than exposing raw database records.

Conceptually:

```text
👨‍🍳 KITCHEN

Orders waiting: 2

#1042 · Mark
Chicken Curry

[Start Preparing]

#1043 · Anna
Custom:
2 chicken curry, one without onions and an omurice

[Start Preparing]
```

When preparation begins:

```text
#1042 · Mark
Chicken Curry

🟠 PREPARING

[Mark Ready]
```

When ready:

```text
#1042 · Mark
Chicken Curry

🟢 READY

[Complete]
```

The kitchen UI should only expose actions valid for the current order state.

---

# 14. Meal Catalogue Management

The administrator should be able to manage predefined meals.

At minimum:

- create meal
- rename meal
- enable/disable meal
- remove meal where appropriate

Disabling a meal removes it from the ordering select menu but MUST NOT alter historical orders that reference it.

Historical orders must continue to display the meal they were placed for.

---

# 15. No Inventory

The meal catalogue is **not an inventory system**.

If the catalogue contains:

```text
Chicken Curry
```

that means:

> The household kitchen is willing to prepare Chicken Curry.

It does not mean:

> There are N portions of Chicken Curry currently in stock.

The initial system therefore requires no:

- stock quantities
- ingredient inventory
- automatic stock deduction
- replenishment
- warehouse state
- out-of-stock calculation

---

# 16. No Pricing

The system has **no pricing model**.

There MUST NOT be:

- prices
- totals
- currency
- payment status
- payment processing
- price snapshots
- invoices

An order represents a request to the household kitchen, not a financial transaction.

---

# 17. No Scheduling

Orders may be placed at any time.

There are no:

- breakfast/lunch/dinner windows
- ordering deadlines
- scheduled menus
- weekly menus
- cutoff times
- future-order scheduling requirements

A predefined meal's availability is simply whether it is currently enabled in the catalogue.

---

# 18. Notifications Are Not State

The database/backend is authoritative.

The following are delivery mechanisms only:

- Discord DM
- ntfy.sh

The system MUST NOT infer order state from whether a notification was successfully delivered.

For example:

```text
Database:
Order #1042 = ORDERED

Discord DM:
failed

ntfy:
delivered
```

The order remains:

```text
ORDERED
```

Notification failures should be logged and handled according to the application's operational error policy.

---

# 19. Deployment

The application is intended to run on a private LAN Kubernetes cluster.

The target environment is:

```text
k0s Kubernetes
      │
      └── managed by ArgoCD
             │
             └── Home Food Ordering
                    │
                    └── PostgreSQL
                         provided by CNPG
```

The application itself should not assume that it is publicly reachable.

The Discord bot requires outbound connectivity to Discord.

The ntfy integration requires outbound connectivity to the configured ntfy.sh endpoint.

PostgreSQL is the persistent datastore.

---

# 20. Architectural Guidance

The implementation should maintain a clear separation between:

```text
Discord UI
     │
     ▼
Application/domain logic
     │
     ├── PostgreSQL
     │
     └── Notification integrations
            ├── Discord DM
            └── ntfy.sh
```

Discord interaction handlers should not contain the complete business logic.

Order creation should be represented as an application/domain operation that can:

1. validate the request
2. persist the order
3. return the created order
4. trigger notification delivery

The exact programming language, framework, ORM/database library, and Discord library are implementation decisions unless constrained elsewhere in the project.

---

# 21. Explicit Non-Goals

The initial implementation MUST NOT expand into any of the following:

- AI ordering assistant
- NLP
- LLM integration
- automatic order interpretation
- restaurant marketplace functionality
- public user registration
- delivery management
- payment processing
- pricing
- inventory management
- ingredient management
- shopping lists
- scheduled ordering
- menu scheduling
- recommendation systems
- automatic substitutions
- automatic spelling correction
- order translation
- multi-tenant architecture

If a feature is not required to support the household ordering workflow, it should not be introduced merely for generality.

---

# 22. Implementation Principle

When making implementation decisions, prefer the smallest design that faithfully implements the specified behavior.

In particular:

> **A predefined meal is a selected catalogue entry. A custom order is a string. An order is a persisted request. Notifications tell the administrator that the request exists.**

No additional intelligence is required between the user's input and the kitchen.