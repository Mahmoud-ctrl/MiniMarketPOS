mod commands;
mod db;
mod error;
mod models;

use tauri::Manager;

const DATABASE_URL: &str = "postgresql://postgres:1289@localhost:5432/minimarket";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(async {
                let pool = db::init_pool(DATABASE_URL)
                    .await
                    .expect("Failed to connect to PostgreSQL");

                db::run_migrations(&pool)
                    .await
                    .expect("Failed to run migrations");

                pool
            });

            app.manage(db::AppState { db: pool });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth / users
            commands::auth::login,
            commands::auth::set_pin,
            commands::auth::create_user,
            commands::auth::get_users,
            // Products
            commands::products::get_products,
            commands::products::get_product_by_barcode,
            commands::products::get_product_by_id,
            commands::products::create_product,
            commands::products::update_product,
            commands::products::toggle_product_frozen,
            commands::products::deactivate_product,
            // Categories
            commands::categories::get_categories,
            commands::categories::create_category,
            commands::categories::update_category,
            commands::categories::delete_category,
            // Suppliers
            commands::suppliers::get_suppliers,
            commands::suppliers::create_supplier,
            commands::suppliers::update_supplier,
            // Sales
            commands::sales::create_sale,
            commands::sales::get_sales,
            commands::sales::get_sale_by_id,
            commands::sales::void_sale,
            commands::sales::get_customer_sales,
            // Inventory
            commands::inventory::get_product_stock,
            commands::inventory::get_low_stock,
            commands::inventory::adjust_inventory,
            commands::inventory::receive_stock,
            // Purchases
            commands::purchases::create_purchase,
            commands::purchases::get_purchases,
            commands::purchases::get_purchase_by_id,
            commands::purchases::receive_purchase,
            commands::purchases::cancel_purchase,
            commands::purchases::void_purchase,
            // Cash sessions
            commands::sessions::open_cash_session,
            commands::sessions::close_cash_session,
            commands::sessions::get_active_session,
            commands::sessions::get_sessions,
            // Reports
            commands::reports::get_sales_summary,
            commands::reports::get_daily_sales,
            commands::reports::get_top_products,
            commands::reports::get_top_customers,
            commands::reports::get_cashier_stats,
            // Customers
            commands::customers::get_customers,
            commands::customers::search_customers,
            commands::customers::create_customer,
            commands::customers::create_customer_quick,
            commands::customers::update_customer,
            commands::customers::deactivate_customer,
            commands::customers::get_customer_ledger,
            commands::customers::record_customer_payment,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_setting,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
