# DBeaver connection

Connect DBeaver to the Postgres 16 database started by `docker-compose.yml` at the repo root.

## Driver

Use the **PostgreSQL** driver. DBeaver downloads it the first time you test a PostgreSQL connection.

## Settings

| Field | Value |
| --- | --- |
| Host | `localhost` |
| Port | `5432` |
| Database | `whatsappbot` |
| Username | `postgres` |
| Password | `postgres` |

Leave the schema filter on the default so `public` is visible.

## Test the connection

1. Start the database from the repo root: `docker compose up -d`.
2. In DBeaver, create a new connection and choose PostgreSQL.
3. Enter the settings above.
4. Click **Test Connection**. A successful test reports that the connection is established. If the PostgreSQL driver is missing, DBeaver prompts you to download it; accept that, then test again.

## Where the tables are

In the Database Navigator:

`whatsappbot` > **Schemas** > **public** > **Tables**

The booking tables (`businesses`, `resources`, `services`, `bookings`, `booking_resources`, and the rest of the shared schema) are all in `public`. This project uses one shared set of tables with `business_id` on tenant-owned rows. It does not create a schema or table per business.

## If port 5432 is already in use

A local Postgres install may already be bound to port 5432. Point Docker at a different host port in `docker-compose.yml`, for example `"5433:5432"`. Then use `5433` in DBeaver and set `DATABASE_URL` in `web/.env.local` to the same port:

```
postgres://postgres:postgres@localhost:5433/whatsappbot
```

The container still listens on 5432 internally. Only the host port changes.
