The most difficult concept in the course was designing for correctness during
concurrent writes. It is easy to describe a ticket purchase as “check whether
a seat is available, then sell it,” but two requests can perform that check at
the same time. I overcame this by tracing the hold and checkout flows as
transactions and learning to rely on database row locks, unique constraints,
and idempotency keys rather than trusting application timing. The TicketHub
design now locks seats in a consistent order, expires holds on the server, and
uses the primary database as the source of truth.

Based on the feedback I received, I would improve the capstone's traffic
model. My first estimates were too generic and did not clearly compare normal
traffic with the concentrated demand for one popular concert. I revised the
design around 50,000 normal visitors and a 200,000-person sale for 20,000
seats. I would improve it further by validating the assumptions with a
load-test plan that measures queue latency, hold conflicts, payment retries,
and fairness.

Next I will learn more about distributed systems and observability. In
particular, I want to practice operating queues, caches, replicas, and
failure recovery under realistic load. I also want to study payment
reconciliation and event-driven design so that an uncertain payment or
worker failure cannot leave a customer charged without a valid ticket.