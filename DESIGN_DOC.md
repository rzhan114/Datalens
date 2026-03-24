# DataLens — Technical Design Document

**Author:** Team 103
**Status:** Final
**Last Updated:** 2026-03-23

---

## 1. Overview

DataLens is a self-hosted, RESTful analytics query service built in TypeScript and Node.js. It allows clients to upload structured datasets (packaged as ZIP files), then run analytical queries against them using a JSON-based query language that supports filtering, grouping, and aggregation — without any external database engine.

The key insight is that the query engine, storage layer, and REST API are all implemented from scratch, making DataLens a demonstration of how analytical database features (scan, filter, group-by, aggregation) can be built at the application layer.

---

## 2. Goals & Non-Goals

### Goals
- Accept structured datasets uploaded as ZIP files (JSON or HTML sources)
- Execute analytical queries: **WHERE** (filter), **GROUP BY** + **APPLY** (aggregation), **ORDER** (sort)
- Expose a versioned REST API (`/api/v1/`) with proper HTTP semantics
- Provide authentication (JWT), request logging, rate limiting, and query-result caching
- Be runnable locally via `yarn start` or via Docker with a single command

### Non-Goals
- Persistent relational storage (no PostgreSQL, SQLite, etc.)
- Real-time / streaming data ingestion
- Multi-user authentication (single-token model is sufficient for this scope)
- Horizontal scaling / distributed query execution

---

## 3. System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        Client (Browser / curl)              │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼─────────────────────────────────┐
│                    Express.js Server                        │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌─────────┐  │
│  │  Morgan  │  │  JWT     │  │ RateLimit  │  │  CORS   │  │
│  │  Logger  │  │  Auth    │  │Middleware  │  │         │  │
│  └──────────┘  └──────────┘  └────────────┘  └─────────┘  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Route Handlers (/api/v1/*)              │   │
│  └───────────────────────────┬─────────────────────────┘   │
│  ┌────────────────────────────▼───────────────────────┐    │
│  │               LRU Query Cache                       │    │
│  └───────────────────────────┬─────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                     InsightFacade                            │
│           (Facade — single entry point for all ops)          │
│  ┌──────────────────┐   ┌──────────────────────────────┐    │
│  │  Dataset Manager │   │       QueryEngine             │    │
│  │  addDataset()    │   │  ┌──────────────────────────┐ │   │
│  │  removeDataset() │   │  │    QueryValidator         │ │   │
│  │  listDatasets()  │   │  │    FilterRegistry         │ │   │
│  └──────────────────┘   │  │    TransformationEngine   │ │   │
│                          │  └──────────────────────────┘ │   │
│                          └──────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              DatasetGenerator (Factory)               │    │
│  │   SectionHelper (JSON/ZIP) │ RoomHelper (HTML/ZIP)   │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │      File System Persistence  (./data/*.json)        │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Data Model

### 4.1 Dataset Kinds

DataLens supports two dataset schemas out of the box:

**Sections** — Course section records (sourced from JSON inside ZIP)

| Field        | Type   | Description                           |
|--------------|--------|---------------------------------------|
| `uuid`       | string | Unique section identifier             |
| `id`         | string | Course number (e.g., "310")           |
| `title`      | string | Course title                          |
| `instructor` | string | Instructor name                       |
| `dept`       | string | Department code (e.g., "CPSC")        |
| `year`       | number | Year offered (1900 = "Overall" entry) |
| `avg`        | number | Section average grade                 |
| `pass`       | number | Number of students who passed         |
| `fail`       | number | Number of students who failed         |
| `audit`      | number | Number of audit students              |

**Rooms** — Campus room records (sourced from HTML inside ZIP)

| Field       | Type   | Description                  |
|-------------|--------|------------------------------|
| `fullname`  | string | Building full name           |
| `shortname` | string | Building code                |
| `number`    | string | Room number                  |
| `name`      | string | Composite: shortname_number  |
| `address`   | string | Street address               |
| `lat`       | number | Latitude (from Geo API)      |
| `lon`       | number | Longitude (from Geo API)     |
| `seats`     | number | Seating capacity             |
| `type`      | string | Room type (e.g., "Lecture")  |
| `furniture` | string | Furniture description        |
| `href`      | string | Link to room listing         |

### 4.2 In-Memory Storage

Datasets are stored as a `Map<string, Dataset>` keyed by dataset ID. On startup, the facade loads all persisted JSON files from `./data/` into this map.

```typescript
interface Dataset {
  id: string;
  kind: InsightDatasetKind;
  data: Section[] | Room[];
}
```

---

## 5. Query Language

Queries are submitted as JSON objects with the following structure:

```json
{
  "WHERE":  { <filter> },
  "OPTIONS": {
    "COLUMNS": ["datasetId_field", ...],
    "ORDER": "datasetId_field" | { "dir": "UP"|"DOWN", "keys": [...] }
  },
  "TRANSFORMATIONS": {
    "GROUP":  ["datasetId_field", ...],
    "APPLY":  [{ "applyKey": { "OPERATOR": "datasetId_field" } }, ...]
  }
}
```

### 5.1 Filter Operators

| Operator | Type    | Description                              |
|----------|---------|------------------------------------------|
| `AND`    | Logical | All sub-filters must match               |
| `OR`     | Logical | At least one sub-filter must match       |
| `NOT`    | Logical | Negates a sub-filter                     |
| `GT`     | Numeric | Greater-than comparison                  |
| `LT`     | Numeric | Less-than comparison                     |
| `EQ`     | Numeric | Equality comparison                      |
| `IS`     | String  | String match with optional `*` wildcards |

### 5.2 Aggregation Operators

| Operator | Input  | Description                                 |
|----------|--------|---------------------------------------------|
| `MAX`    | number | Maximum value in group                      |
| `MIN`    | number | Minimum value in group                      |
| `AVG`    | number | Average using Decimal.js (2 decimal places) |
| `SUM`    | number | Sum using Decimal.js (2 decimal places)     |
| `COUNT`  | any    | Count of unique values in group             |

### 5.3 Query Execution Pipeline

```
Query JSON
    │
    ▼
QueryValidator     ← Structural validation, field name resolution, dataset ID extraction
    │
    ▼
FilterRegistry     ← Strategy pattern: applies WHERE clause recursively
    │
    ▼
TransformationEngine  ← GROUP BY + APPLY aggregation (hash-based grouping)
    │
    ▼
Sort + Column Projection  ← ORDER clause, COLUMNS whitelist
    │
    ▼
Result (max 5000 rows) → ResultTooLargeError if exceeded
```

---

## 6. API Design

Base path: `/api/v1/`

All endpoints (except `GET /health`) require a valid JWT in the `Authorization: Bearer <token>` header.

### 6.1 Authentication

| Method | Path           | Description                  |
|--------|----------------|------------------------------|
| POST   | `/auth/token`  | Exchange API key for JWT     |

Request body:
```json
{ "apiKey": "your-api-key" }
```

Response:
```json
{ "token": "<jwt>" }
```

JWT payload: `{ sub: "datalens-client", iat, exp }` — tokens expire in 24 hours.

### 6.2 Dataset Management

| Method | Path                    | Description               |
|--------|-------------------------|---------------------------|
| PUT    | `/api/v1/dataset/:id`   | Upload dataset (ZIP body) |
| DELETE | `/api/v1/dataset/:id`   | Remove a dataset          |
| GET    | `/api/v1/datasets`      | List all datasets         |

**PUT `/api/v1/dataset/:id`**
Body: raw ZIP binary (application/octet-stream or application/zip, max 10MB)
Query param: `?kind=sections` (default) or `?kind=rooms`

Response `200`:
```json
{ "result": ["sections", "rooms"] }
```

Response `400`:
```json
{ "error": "Dataset already exists", "code": "CONFLICT" }
```

**DELETE `/api/v1/dataset/:id`**
Response `200`:
```json
{ "result": "sections" }
```

Response `404`:
```json
{ "error": "Dataset not found", "code": "NOT_FOUND" }
```

### 6.3 Query

| Method | Path               | Description          |
|--------|--------------------|----------------------|
| POST   | `/api/v1/query`    | Execute a query      |

Request body: JSON query object (see §5)

Response `200`:
```json
{ "result": [ { "sections_dept": "CPSC", "avgGrade": 78.5 }, ... ] }
```

Response `400`:
```json
{ "error": "COLUMNS must only reference GROUP or APPLY keys", "code": "INVALID_QUERY" }
```

Response `413`:
```json
{ "error": "Query result exceeds 5000 rows", "code": "RESULT_TOO_LARGE" }
```

### 6.4 Analytics Endpoints

| Method | Path                                           | Description                    |
|--------|------------------------------------------------|--------------------------------|
| GET    | `/api/v1/analytics/:id/departments`            | List all departments           |
| GET    | `/api/v1/analytics/:id/courses/:dept`          | Courses in a department        |
| GET    | `/api/v1/analytics/:id/trend/:dept/:courseId`  | Year-over-year enrollment      |
| GET    | `/api/v1/analytics/:id/instructors/:dept`      | Instructors in a department    |

### 6.5 System

| Method | Path      | Description                           |
|--------|-----------|---------------------------------------|
| GET    | `/health` | Returns `200 OK` with uptime + status |

Response:
```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-03-23T10:00:00.000Z",
  "datasetsLoaded": 2
}
```

### 6.6 Standardized Error Response Format

All errors follow the same envelope:

```json
{
  "error": "<human-readable message>",
  "code":  "<machine-readable code>"
}
```

| HTTP Status | Code               | When                                   |
|-------------|--------------------|----------------------------------------|
| 400         | `INVALID_QUERY`    | Malformed query or dataset operation   |
| 401         | `UNAUTHORIZED`     | Missing or invalid JWT                 |
| 404         | `NOT_FOUND`        | Dataset not found                      |
| 409         | `CONFLICT`         | Duplicate dataset ID                   |
| 413         | `RESULT_TOO_LARGE` | Query exceeds 5000-row limit           |
| 429         | `RATE_LIMITED`     | Too many requests                      |
| 500         | `INTERNAL_ERROR`   | Unexpected server error                |

---

## 7. Middleware Stack

Requests flow through the following middleware in order:

```
Request
  │
  ├─ Morgan Logger        (logs method, path, status, response time)
  ├─ CORS                 (allow all origins in dev; configurable for prod)
  ├─ express.json()       (parse JSON bodies)
  ├─ express.raw()        (parse binary ZIP uploads, max 10MB)
  ├─ Rate Limiter         (100 req / 15 min per IP; 429 on exceeded)
  ├─ JWT Auth Guard       (validates Bearer token; skip /health and /auth/*)
  ├─ Route Handler        (business logic)
  ├─ LRU Query Cache      (check cache before executing query; store result after)
  └─ Error Handler        (catch-all: maps InsightError / NotFoundError to JSON)
```

---

## 8. LRU Query Result Cache

**Problem:** Repeated identical queries rescan the full in-memory dataset each time.

**Solution:** An LRU (Least Recently Used) cache keyed by the SHA-256 hash of the serialized query JSON.

**Implementation:**

```
POST /api/v1/query
    │
    ├── hash = sha256(JSON.stringify(query))
    ├── if cache.has(hash) → return cached result immediately (cache HIT)
    └── else → execute query → cache.set(hash, result) → return result (cache MISS)
```

**Parameters:**
- Capacity: 100 entries (configurable via `CACHE_MAX_SIZE` env var)
- TTL: 5 minutes (evict stale results after dataset changes)
- Invalidation: entire cache is flushed on `addDataset` or `removeDataset`

**Why LRU over a simple Map:** Bounded memory usage — the cache evicts the least-recently-used entry when capacity is reached, preventing unbounded growth.

---

## 9. Authentication Model

**Approach:** Stateless JWT (JSON Web Token) authentication.

1. Client presents an API key (stored as `API_KEY` environment variable) via `POST /auth/token`
2. Server validates the key and issues a signed JWT (secret: `JWT_SECRET` env var)
3. Client includes the JWT in subsequent requests as `Authorization: Bearer <token>`
4. JWT middleware verifies the signature and expiry on every protected route

**Why JWT over session cookies:**
- Stateless — no server-side session store needed
- Standard — plays well with mobile clients, curl, and frontend frameworks
- Self-contained — expiry is embedded in the token

---

## 10. Dataset Ingestion Pipeline

### Sections (JSON/ZIP)

```
ZIP binary (base64)
  │
  └── JSZip.loadAsync()
        │
        └── courses/* → JSON.parse() each file → extract result[] array
              │
              └── Map JSON fields → Section interface
                    (parallel: Promise.all for all course files)
```

### Rooms (HTML/ZIP)

```
ZIP binary (base64)
  │
  └── JSZip.loadAsync()
        │
        ├── index.htm → parse5 DOM traversal → extract buildings (fullname, shortname, address, href)
        │
        ├── For each building: load <href>.htm → parse5 → extract room rows
        │
        └── For each address: HTTP GET geo API → { lat, lon }
              (cached in geoCache Map to avoid duplicate HTTP calls)
              (parallel: Promise.all for all buildings)
```

---

## 11. Design Patterns Used

| Pattern              | Where                                | Purpose                                                              |
|----------------------|--------------------------------------|----------------------------------------------------------------------|
| **Facade**           | `InsightFacade`                      | Single entry point; hides internal complexity from REST layer        |
| **Strategy**         | `QueryFilters` (filter types)        | Each filter operator is a self-contained, swappable class            |
| **Strategy**         | `AggregationStrategy` (MAX/MIN/etc.) | Each aggregation operator is independently encapsulated              |
| **Factory**          | `DatasetGenerator`                   | Creates correct helper (SectionHelper or RoomHelper) by dataset kind |
| **Registry**         | `FilterRegistry`                     | Maps filter operator strings to strategy instances at runtime        |
| **Pipeline**         | `QueryEngine.performQuery()`         | Linear chain: validate → filter → transform → sort → limit          |
| **Middleware Chain** | Express middleware stack             | Cross-cutting concerns (auth, logging, caching) without polluting routes |

---

## 12. Testing Strategy

### Unit Tests
- `AggregationStrategy` — test each operator (MAX, MIN, AVG, SUM, COUNT) with known inputs
- `QueryValidator` — test structural validation rules in isolation
- `QueryFilters` — test each filter type with edge cases (empty string, wildcard `*`)
- `TransformationEngine` — test grouping and aggregation with small datasets

### Integration Tests
- `InsightFacade.spec.ts` — add → query → remove lifecycle; error cases (invalid id, duplicate, not found)
- `Server.spec.ts` — HTTP-level tests using Supertest; verifies correct status codes and response shapes
- `agg.spec.ts` — end-to-end queries with GROUP BY + APPLY
- `InsightFacadeRooms.spec.ts` — room dataset ingestion and querying

### Test Data
- `pair.zip` — real UBC course dataset (~64k section records); used for performance and correctness
- `campus.zip` — UBC building/room HTML dataset
- `oneCourse.zip`, `csCourse.zip` — minimal datasets for targeted unit tests
- `invalid_*.zip` — malformed archives for error-path coverage

### Coverage
- Tool: `nyc` (Istanbul) — `yarn cover` generates HTML report
- Target: ≥ 80% line and branch coverage across `src/`

---

## 13. Deployment

### Local Development

```bash
yarn install
yarn start          # ts-node src/App.ts on port 1220
yarn test           # mocha test suite
yarn cover          # test + HTML coverage report
```

### Docker

```bash
docker build -t datalens .
docker run -p 1220:1220 -e JWT_SECRET=secret -e API_KEY=mykey datalens
```

### Docker Compose (with volume for persistence)

```bash
docker-compose up
```

This starts the server and mounts `./data` as a Docker volume so datasets persist across container restarts.

### CI/CD (GitHub Actions)

On every push to `main` and every pull request:
1. Install dependencies (`yarn install`)
2. Type check + format check (`yarn build`)
3. Run full test suite (`yarn test`)
4. Upload coverage report artifact

---

## 14. Environment Variables

| Variable        | Default     | Description                                 |
|-----------------|-------------|---------------------------------------------|
| `PORT`          | `1220`      | HTTP server port                            |
| `JWT_SECRET`    | —           | Secret for signing JWTs (required in prod)  |
| `API_KEY`       | —           | API key clients use to obtain a JWT         |
| `CACHE_MAX_SIZE`| `100`       | Max number of cached query results          |
| `RATE_LIMIT_MAX`| `100`       | Max requests per IP per 15-minute window    |
| `DATA_DIR`      | `./data`    | Directory for persisted dataset JSON files  |
| `NODE_ENV`      | `development` | Set to `production` to enable stricter settings |

---

## 15. Key Trade-offs & Future Work

### Trade-offs Made

| Decision                               | Reason                                                                  |
|----------------------------------------|-------------------------------------------------------------------------|
| File-system JSON persistence over DB   | Simplicity; no external DB dependency; suitable for single-node deploy  |
| In-memory dataset storage              | Fast query scans; acceptable for datasets up to ~100k rows              |
| Custom query language (not SQL)        | Provides a well-typed, JSON-native API easier to consume from frontend  |
| LRU cache invalidation on any mutation | Correctness over cache efficiency; avoids stale reads after dataset ops |
| Single JWT secret (no per-user auth)   | Sufficient for personal analytics tool; full RBAC out of scope          |

### Future Work

- **Pagination**: Return cursor-based paginated results instead of enforcing hard 5000-row limit
- **Streaming ingestion**: Accept NDJSON stream uploads for large datasets
- **Index structures**: B-tree or hash index on frequently filtered fields to avoid full scans
- **WebSocket push**: Push query results to client as they are computed (for slow aggregations)
- **OpenAPI spec**: Auto-generate Swagger UI from TypeScript types
- **Multi-dataset JOINs**: Allow queries that span two datasets

---

## 16. File Structure

```
.
├── src/
│   ├── App.ts                        # Entry point, server bootstrap
│   ├── controller/
│   │   ├── IInsightFacade.ts         # Public interfaces & error classes
│   │   ├── InsightFacade.ts          # Facade: dataset lifecycle management
│   │   ├── QueryEngine.ts            # Query execution orchestrator (pipeline)
│   │   ├── QueryValidator.ts         # Structural + semantic query validation
│   │   ├── QueryFilters.ts           # Strategy: AND/OR/NOT/GT/LT/EQ/IS filters
│   │   ├── TransformationEngine.ts   # GROUP BY + APPLY aggregation
│   │   ├── AggregationStrategy.ts    # Strategy: MAX/MIN/AVG/SUM/COUNT
│   │   ├── DatasetGenerator.ts       # Factory: SectionHelper | RoomHelper
│   │   ├── SectionHelper.ts          # JSON/ZIP ingestion for course sections
│   │   ├── RoomHelper.ts             # HTML/ZIP + geo API ingestion for rooms
│   │   └── IDatasetHelper.ts         # Interface for dataset helpers
│   ├── middleware/
│   │   ├── auth.ts                   # JWT verification middleware
│   │   ├── queryCache.ts             # LRU query result cache
│   │   ├── rateLimit.ts              # Express rate limiting
│   │   └── errorHandler.ts           # Centralized error → JSON response mapping
│   └── rest/
│       ├── Server.ts                 # Express app: routes + middleware wiring
│       └── QueryBuilder.ts           # Query construction helpers for analytics endpoints
├── test/
│   ├── controller/
│   │   ├── InsightFacade.spec.ts
│   │   ├── InsightFacadeRooms.spec.ts
│   │   └── agg.spec.ts
│   └── rest/
│       └── Server.spec.ts
├── Dockerfile
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── ci.yml
├── DESIGN_DOC.md                     # This document
├── package.json
└── tsconfig.json
```
