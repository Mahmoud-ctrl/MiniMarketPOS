# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Tauri v2 (Rust backend) + React 19 + TypeScript + Vite + Tailwind CSS v4, backed by **PostgreSQL** via `sqlx`.

## Commands

```bash
# Run the full desktop app (starts Vite dev server + Tauri window)
npm run tauri dev

# Build a distributable binary
npm run tauri build

# Frontend only (Vite at http://localhost:1420)
npm run dev

# TypeScript type-check without emitting
npx tsc --noEmit
```

There are no automated tests yet.

## Database

**Connection string is hardcoded** in `src-tauri/src/lib.rs`:
```
postgresql://postgres:1289@localhost:5432/minimarket
```
PostgreSQL must be running locally before launching the app.

Migrations live in `src-tauri/migrations/` and run automatically on startup via `sqlx::migrate!`. Add new migrations as numbered SQL files (`003_...sql`, etc.).

**Key schema decisions:**
- All monetary values are stored as `BIGINT` (integer cents/millimes), never floats.
- Stock levels are **event-sourced**: there is no stock column on `products`. Stock is the `SUM(quantity_delta)` across `inventory_movements` for each product. The `v_product_stock` view (defined in migration 002) computes current stock and a `low_stock_flag` by joining products → categories → inventory_movements.
- Three price tiers per product: `sell_price_retail`, `sell_price_wholesale`, `sell_price_special`.
- `is_frozen` products appear in the UI but cannot be added to cart.

## Architecture

### Backend (`src-tauri/src/`)

- `lib.rs` — App entry point. Initialises the `PgPool`, runs migrations, registers all Tauri commands via `invoke_handler!`.
- `db.rs` — `AppState { db: PgPool }`. All commands receive this via `State<'_, AppState>`.
- `models.rs` — Single file holding every Rust struct: DB row types (`#[derive(FromRow)]`), API payload types (`#[derive(Deserialize)]`), and response types (`#[derive(Serialize)]`).
- `error.rs` — `AppError { message: String }` implements `From<sqlx::Error>` and `From<chrono::ParseError>`. All commands return `Result<T, AppError>`.
- `commands/` — One file per domain, all registered in `lib.rs`:
  - `auth.rs` — PIN login, set_pin, create_user, get_users. **PIN is currently stored and compared as plain text.** There are `TODO` comments for Argon2 hashing.
  - `sales.rs` — `create_sale` runs a single DB transaction: insert sale header → insert sale_items → insert inventory_movements (type `sale`, delta = `-quantity`). `void_sale` reverses stock via `return_in` movements.
  - `inventory.rs` — Reads from `v_product_stock` view; `adjust_inventory` inserts directly into `inventory_movements`.
  - `products.rs`, `categories.rs`, `suppliers.rs`, `sessions.rs` — standard CRUD.

### Frontend (`src/`)

- `main.tsx` → `App.tsx` — Top-level auth gate: renders `LoginScreen` until a `User` is set, then `POSScreen`.
- `POSScreen.tsx` — Owns the in-memory cart and app-level navigation (`pos` | `inventory` | `reports` | `customers` | `settings`). Reports and Customers are stubs ("Coming soon").
- `src/lib/api.ts` — **Single point of contact with Tauri.** All `invoke()` calls go here; components never call `invoke()` directly.
- `src/types/index.ts` — TypeScript interfaces mirroring Rust models. `ProductStock` differs from `Product`: it uses `product_id` (not `id`) and adds `stock_qty`, `low_stock_flag`, `category_name`.

### Adding a new Tauri command

1. Add the Rust function (with `#[tauri::command]`) to the relevant file in `src-tauri/src/commands/`.
2. Register it in the `invoke_handler!` list in `src-tauri/src/lib.rs`.
3. Add a typed wrapper to `src/lib/api.ts`.
4. Add any new types to `src/types/index.ts` and `src-tauri/src/models.rs`.
