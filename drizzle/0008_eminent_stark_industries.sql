CREATE TABLE `vendor_fetch_state` (
	`source_id` text PRIMARY KEY NOT NULL,
	`last_fetched_at` text,
	`last_attempt_at` text NOT NULL,
	`last_status` text NOT NULL,
	`last_message` text,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
