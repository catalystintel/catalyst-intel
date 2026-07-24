CREATE TABLE `ingestion_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ran_at` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`fetched` integer DEFAULT 0 NOT NULL,
	`inserted` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`sources_json` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
