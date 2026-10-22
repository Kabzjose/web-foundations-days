# TicketHub system design

TicketHub sells reserved seats for concerts and other events. The design
optimizes for a trustworthy purchase flow: a customer should never be charged
for a seat that another customer successfully bought.

## 1. Requirements

### Functional requirements

- Visitors can browse events by artist, venue, city, date, and category.
- Visitors can view an event's venue layout, prices, and current seat
  availability.
- Customers can create an account, sign in, and manage contact and payment
  details through a payment provider.
- A customer can select one or more seats, temporarily hold them, and check
  out before the hold expires.
- The system validates payment, confirms the order, issues tickets with
  scannable ticket IDs, and sends a confirmation email.
- Customers can view their orders and tickets and request a refund according to
  the event's policy.
- Organizers can create events, configure venue seats and ticket prices, and
  see sales.
- Staff can scan a ticket at the venue and see whether it is valid and unused.
- Failed payments, expired holds, duplicate requests, and unavailable seats
  must return clear errors rather than creating a partial order.

### Non-functional requirements

- **Correctness:** one seat for one event can have at most one confirmed
  purchase. Payment and ticket issuance must be auditable.
- **Availability:** browsing should remain available during failures in email or
  analytics systems. The purchase path should target 99.95% monthly
  availability.
- **Performance:** cached event pages should load in under 300 ms at the
  95th percentile; seat-map and hold operations should respond in under 500 ms
  at the 95th percentile when dependencies are healthy.
- **Scalability:** scale read traffic and checkout workers independently, and
  absorb a concert-sale burst without dropping requests.
- **Security:** use TLS, hashed passwords, least-privilege service accounts,
  encrypted payment references, authorization checks for organizer routes, and
  idempotency keys for money-moving requests. TicketHub does not store raw
  card numbers.
- **Durability and recovery:** confirmed orders must survive an application
  restart. Backups, replication, and a tested restore process target an RPO of
  five minutes and an RTO of one hour.
- **Observability:** record structured logs, metrics for holds and payment
  failures, traces for checkout, and alerts for inventory conflicts and queue
  lag.

## 2. Estimates

These are capacity-planning assumptions rather than forecasts. TicketHub has
2 million registered customers. On a normal day, 50,000 people visit and each
views 10 pages. TicketHub sells 5,000 tickets per normal day.

### Normal traffic

- Browse and event/seat-map requests: 50,000 visitors x 10 pages = 500,000
  page requests per day / 86,400 = **about 5.8 RPS** on average. Planning
  for a 5x daily peak gives **about 29 RPS**.
- Ticket sales: 5,000 tickets / 86,400 = **about 0.06 ticket purchases per
  second** on average. The actual checkout-request rate is higher because
  some customers abandon or retry, so the API should still use idempotency
  keys and backpressure.
- If each event has 5,000 seats, 10,000 events represent **50 million seat
  inventory rows**. Seat inventory is metadata, not a large media payload, so
  a relational database with indexes and partitioning can store it.

### Very popular concert sale

For a popular concert, 200,000 people try to buy 20,000 seats in the first
10 minutes (600 seconds). The arrival rate is 200,000 / 600 = **about 333
visitors per second**, or roughly **58 times the normal average browsing
rate**. If every seat is eventually sold, the sale completes at an average
of 20,000 / 600 = **about 33 confirmed tickets per second**, roughly **576
times the normal ticket-sales rate**. Requests will cluster more heavily than
this average at the opening instant, so the system needs admission control and
burst capacity.

The system should not send all of those requests directly to the database.
The CDN and an admission queue absorb browsing and waiting-room traffic. A
per-event rate limiter and a serialized inventory command path protect the
authoritative seat rows. The sale can be deliberately queued: customers
receive a signed queue token, and only a controlled number of users may enter
the seat-selection flow at once. Capacity is therefore sized for the admitted
hold rate, not the unbounded arrival rate.

## 3. API

The public API is versioned under `/api/v1`. JSON responses include an
`X-Request-Id`; mutations that can be retried accept an `Idempotency-Key`.

| Method and endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /events?city=&from=&to=&category=` | Optional | Search and filter events. |
| `GET /events/{eventId}` | Optional | Return event, venue, prices, and sale status. |
| `GET /events/{eventId}/seats` | Optional | Return seat-map availability, preferably from a short-lived cache. |
| `POST /events/{eventId}/holds` | Customer | Atomically hold requested seat IDs for 10 minutes; returns `holdId` and expiry. |
| `DELETE /holds/{holdId}` | Customer | Release an unpurchased hold. |
| `POST /orders` | Customer | Convert a valid hold into an order and authorize payment. Requires an idempotency key. |
| `GET /orders/{orderId}` | Customer | Return order, payment, and ticket status. |
| `GET /me/tickets` | Customer | List the customer's tickets. |
| `POST /tickets/{ticketId}/scan` | Venue staff | Validate and atomically mark a ticket as used. |
| `POST /organizer/events` | Organizer | Create an event and its inventory configuration. |

The hold endpoint returns `409 Conflict` when any requested seat is no longer
available, `401` for an unauthenticated customer, and `422` for malformed
seat IDs. The order endpoint returns `410 Gone` for an expired hold and
`402 Payment Required` for a declined payment. Repeating the same
`Idempotency-Key` returns the original result instead of charging twice.

## 4. Data model

PostgreSQL is the source of truth for event inventory and orders. Important
tables and relationships are:

```text
users 1---* orders 1---* order_items *---1 event_seats *---1 events
events 1---1 venues 1---* venue_seats
users 1---* seat_holds 1---* hold_items *---1 event_seats
order_items 1---1 tickets
events 1---* prices
```

- **`users`** (`id`, `email` unique, `password_hash`, `role`,
  `created_at`): customers, organizers, and venue staff.
- **`venues`** (`id`, `name`, `address`): physical locations.
- **`venue_seats`** (`id`, `venue_id`, `section`, `row_label`, `seat_number`);
  `UNIQUE (venue_id, section, row_label, seat_number)` describes a physical
  seat once.
- **`events`** (`id`, `venue_id`, `organizer_id`, `name`, `starts_at`,
  `sale_state`): a concert or event at a venue. An event references one venue
  and one organizer.
- **`event_seats`** (`id`, `event_id`, `venue_seat_id`, `price_id`, `status`,
  `hold_id`, `hold_expires_at`): the event-specific inventory snapshot.
  `UNIQUE (event_id, venue_seat_id)` prevents duplicate inventory for an event.
  `status` is `available`, `held`, or `sold`.
- **`seat_holds`** (`id`, `user_id`, `event_id`, `expires_at`, `status`,
  `created_at`): a short-lived reservation. A hold has many `hold_items`.
- **`hold_items`** (`hold_id`, `event_seat_id`): the seats in a hold, with a
  composite primary key and a unique `event_seat_id` while active.
- **`orders`** (`id`, `user_id`, `event_id`, `hold_id` unique, `status`,
  `payment_reference`, `total_cents`, `created_at`): one checkout result.
  `payment_reference` is a provider token, not card data.
- **`order_items`** (`id`, `order_id`, `event_seat_id`, `price_cents`):
  immutable purchased-seat and price records.
- **`tickets`** (`id`, `order_item_id` unique, `public_token_hash`, `status`,
  `used_at`): one ticket per order item; the token is shown as a QR code.

### Preventing a double sale

The database, not a cache, decides whether a seat is available. Creating a
hold runs in one transaction:

1. Validate that all seat IDs belong to the requested event.
2. Lock the requested `event_seats` rows with `SELECT ... FOR UPDATE` in a
   stable sorted order.
3. Treat a `held` row whose `hold_expires_at` is in the past as available,
   then update all requested rows to `held` with the new hold ID and expiry.
4. If any row is `sold`, or is held by a non-expired hold, roll back the whole
   transaction and return `409`; no subset is held.

Checkout locks the same rows, verifies that the hold belongs to the customer
and has not expired, changes every row from `held` to `sold`, inserts the order
and order items, and commits. A database check/unique constraint on
`(event_id, venue_seat_id)` and the `sold` state provide a second invariant.
Two simultaneous transactions cannot both lock and transition the same row:
the first transaction commits the hold or sale, and the second re-reads the
row and fails. The payment provider is called with the order's idempotency
key; a payment failure rolls back the sale (or a reconciliation worker
immediately cancels an uncertain authorization), so a retry cannot create a
second order or charge.

Redis may cache seat-map reads and coordinate rate limits, but it is never the
authority for ownership. A scheduled cleanup job releases expired holds, and
the transaction also checks expiry so a delayed cleanup cannot block a seat
indefinitely.

## 5. Architecture

```text
 Customers/staff
       |
   DNS + CDN ---- static event pages and cached seat-map reads
       |
   WAF + load balancer
       |
   Waiting room / admission controller (sale-specific)
       |
   Stateless API servers
     |        |          \
     |        |           \-- Auth and rate-limit service
     |        |
  Redis    Checkout command queue
 (cache,        |
  limits)   Checkout workers
                |
        +-------+--------+
        | PostgreSQL     |--- read replica(s)
        | primary        |
        | inventory,     |
        | orders         |
        +-------+--------+
                |
       Payment provider
                |
       Durable job queue ---> email/ticket workers ---> object storage
                                                (QR/PDF assets)
```

### Component explanation

- **DNS, CDN, and WAF:** serve cacheable content at the edge, block common
  attacks, and reduce origin load during a sale.
- **Waiting room/admission controller:** assigns signed queue positions and
  admits a bounded number of customers per event. It prevents a flash crowd
  from becoming a database flash sale.
- **Load balancer and stateless API servers:** authenticate requests, validate
  input, expose the API, and scale horizontally without session affinity.
- **Redis:** stores short-lived cached event data, rate-limit counters, and
  queue metadata. It is disposable and cannot grant a seat.
- **Checkout queue and workers:** serialize or throttle expensive hold and
  checkout commands per event, retry transient failures, and provide
  backpressure.
- **PostgreSQL primary:** durably enforces row locks, unique constraints,
  hold expiry, order state, and the seat ownership invariant.
- **Read replicas:** serve event and order queries when replica lag is
  acceptable; authoritative hold and checkout reads go to the primary.
- **Payment provider:** tokenizes card payments and returns an authorization or
  decline. Webhooks are verified and processed idempotently.
- **Durable queue, workers, and object storage:** issue QR/PDF assets and send
  email asynchronously. Retries and a dead-letter queue prevent an email
  outage from invalidating a paid order.

## 6. Trade-offs

- **Relational row locking vs. a highly distributed inventory store:** PostgreSQL
  transactions make the no-double-sale invariant and audit trail easy to
  reason about. The trade-off is contention for extremely popular events.
  Per-event admission, sorted lock acquisition, short transactions, and
  partitioning reduce contention; a specialized distributed inventory service
  could scale further but would add operational and consistency complexity.
- **Temporary holds vs. immediate checkout:** Holds let customers enter payment
  details without losing a selected seat and make the user experience fairer.
  They temporarily hide inventory, can be abandoned, and require expiry
  cleanup. A ten-minute TTL and server-side expiry checks limit that cost.
- **Waiting room vs. open access:** A waiting room protects the database and
  gives a predictable sale experience under a million-RPS arrival burst. It
  adds queue latency and means customers cannot all browse and buy
  simultaneously, so the UI must show an honest queue position and estimated
  wait.
- **Read replicas and caching vs. freshest availability:** Caches and replicas
  lower cost and latency for browsing, but can show a seat as available just
  after another customer held it. The hold transaction always rechecks the
  primary and returns a conflict when the cached view is stale.
- **Asynchronous ticket delivery vs. synchronous confirmation:** Queue-based
  email and QR generation keep checkout fast and resilient to provider
  outages. The order confirmation is returned immediately with a durable
  ticket record, while delivery can be retried and monitored separately.