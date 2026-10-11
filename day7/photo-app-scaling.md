# SnapShare scaling plan

## 1. Assumptions and daily active users

- There are 10 million registered users, and 10% are active on an average
  day, so the daily active user count is 1 million.
- Each daily active user uploads one photo and views 50 feed pages.
- Traffic is spread evenly for average-rate calculations, and peak feed
  traffic is estimated as 5x the average because users will not act uniformly
  throughout the day.
- A photo is 2 MB and its thumbnail is 50 KB. These estimates use decimal
  megabytes and exclude extra copies for database replication, backups, and
  storage-provider metadata.

Calculation: 10 million registered users x 10% active = **1 million daily
active users**.

## 2. Traffic and storage calculations

The resulting rates and annual storage growth are:

- **Uploads:** 1 million uploads per day / 86,400 seconds = **about 12
  uploads per second** on average.
- **Feed views:** 1 million users x 50 pages per day = 50 million feed pages
  per day / 86,400 seconds = **about 579 feed views per second** on average;
  at 5x peak, plan for **about 2,894 feed views per second**.
- **Storage:** 1 million photos per day x 365 days = 365 million photos per
  year. Each photo and thumbnail use 2.05 MB together, so annual growth is
  365 million x 2.05 MB = **748.25 TB per year** (730 TB of originals plus
  18.25 TB of thumbnails).

## 3. Read/write balance and design impact

This is a **read-heavy** system: the average feed-view rate is roughly 50
times the upload rate, before accounting for the additional reads involved in
rendering a feed. The design should therefore scale read capacity horizontally
with app servers, a cache, a CDN, and a database read replica, while keeping
the write path durable and relatively simple.

## 4. Photo storage

Photos should not be stored inside the database because large binary values
would make database backups, replication, queries, and storage costs heavier,
while competing with smaller, latency-sensitive metadata such as users,
follows, and feed records. The original photos and generated thumbnails should
go in durable object storage, with the database storing only metadata and
object keys; the CDN can then cache and deliver those files close to users.

## 5. Architecture

```text
                                  +----------------+
                                  |      CDN       |
                                  | cached photos  |
                                  +-------+--------+
                                          |
Users ---- HTTPS -----------------> +-----v------+
                                   | Load       |
                                   | balancer   |
                                   +-----+------+
                                         |
                         +---------------v----------------+
                         |       App server pool          |
                         | feed API, auth, upload control |
                         +---+---------+-------------+---+
                             |         |             |
                       +-----v----+ +--v---------+   |
                       |  Cache   | | Database   |   |
                       | feed data| | primary    |   |
                       +----------+ +--+------+---+   |
                                       |      |       |
                                  writes|      |reads  |
                                       |  +---v--------+
                                       |  | Read       |
                                       |  | replica    |
                                       |  +------------+
                                       |
                             +---------v----------+
                             | Object storage     |
                             | originals + thumbs |
                             +---------+----------+
                                       ^
                                       | thumbnail output
                             +---------+----------+
                             | Queue              |
                             +---------+----------+
                                       |
                             +---------v----------+
                             | Thumbnail worker   |
                             +--------------------+
```

- **CDN:** Serves frequently viewed photo files from edge locations, reducing
  bandwidth and latency at the application and object-storage layers.
- **Load balancer:** Distributes requests across healthy app servers and
  provides a single endpoint for horizontal scaling and health checks.
- **App servers:** Authenticate users, validate requests, assemble feeds, and
  issue upload and object-storage operations without keeping session state
  locally.
- **Cache:** Keeps hot feed pages and short-lived metadata in memory, reducing
  repeated database reads for popular feeds.
- **Database:** Stores users, follows, photo metadata, and feed relationships
  durably, with the primary handling writes.
- **Read replica:** Handles feed and photo-metadata queries separately from
  writes, increasing read capacity without making the primary handle all
  traffic.
- **Object storage:** Stores large original photo files and generated
  thumbnails cheaply and durably instead of putting binary data in the
  database.
- **Queue:** Buffers thumbnail jobs so an upload does not have to wait for
  image processing and absorbs bursts for reliable asynchronous work.
- **Thumbnail worker:** Consumes queued jobs, creates 50 KB thumbnails, and
  writes them back to object storage while updating photo metadata.

## Photo upload flow

1. The client sends an upload request to an app server, which authenticates the
   user and validates the file type, size, and upload permissions.
2. The app server creates a photo ID and returns a short-lived, signed
   object-storage upload URL. This keeps the large file transfer off the app
   servers.
3. The client uploads the 2 MB original directly to object storage using that
   URL.
4. After the upload succeeds, the client notifies the app server (or the
   storage event notifies it), and the app server records the photo metadata
   and original object key in the primary database.
5. The app server publishes a thumbnail job containing the photo ID and object
   key to the queue, then returns an accepted/uploaded response to the client.
6. A thumbnail worker consumes the job, reads the original, creates the 50 KB
   thumbnail, stores it in object storage, and marks the thumbnail as ready in
   the database.
7. Feed reads initially use a placeholder or the original's processing state;
   once the thumbnail is ready, the CDN can cache and serve the thumbnail URL.

## Trade-offs

- **Direct-to-object-storage uploads vs. proxying through app servers:** Direct
  uploads preserve app-server capacity and reduce bandwidth costs, but signed
  URL creation and storage-event handling add workflow complexity.
- **Asynchronous thumbnails vs. synchronous processing:** A queue makes upload
  latency predictable and lets workers scale independently, but thumbnails are
  temporarily unavailable and the system needs retries and dead-letter
  handling for failed jobs.
- **Read replica and cache vs. strongly consistent reads:** Replicas and cached
  feeds provide much higher read throughput, but replication lag or stale cache
  entries can briefly delay the appearance of a new photo or follow.
- **Object storage vs. database blobs:** Object storage is better suited to
  hundreds of terabytes of media and supports CDN integration, but it requires
  separate metadata, access-control, and lifecycle-management logic.
