\echo Applying ordered migrations from /docker-entrypoint-initdb.d/migrations
\i /docker-entrypoint-initdb.d/migrations/V1__init_schema.sql
\i /docker-entrypoint-initdb.d/migrations/V2__seed_data.sql
\i /docker-entrypoint-initdb.d/migrations/V3__convert_enums_to_varchar.sql
\i /docker-entrypoint-initdb.d/migrations/V4__notification_reminder_document_tracking.sql
\i /docker-entrypoint-initdb.d/migrations/V5__add_validator_last_seen_pending_at.sql
\i /docker-entrypoint-initdb.d/migrations/V6__seed_italian_business_categories.sql
\i /docker-entrypoint-initdb.d/migrations/V7__localize_and_reset_categories_to_ateco_sections.sql
\i /docker-entrypoint-initdb.d/migrations/V8__add_supplier_preferred_language.sql
\i /docker-entrypoint-initdb.d/migrations/V9__create_revamp_v2_core_tables.sql
\i /docker-entrypoint-initdb.d/migrations/V10__create_revamp_final_name_compat_views.sql
\i /docker-entrypoint-initdb.d/migrations/V11__materialize_final_table_names_with_revamp_compat_views.sql
\i /docker-entrypoint-initdb.d/migrations/V12__rename_revamp_db_objects_to_final_names.sql
\i /docker-entrypoint-initdb.d/migrations/V13__normalize_validator_role_to_admin.sql
\i /docker-entrypoint-initdb.d/migrations/V14__rename_validator_last_seen_column_to_admin.sql
\i /docker-entrypoint-initdb.d/migrations/V15__retire_legacy_user_role_enum_artifacts.sql
