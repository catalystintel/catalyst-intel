CREATE TABLE `saved_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`window` text NOT NULL,
	`scope` text NOT NULL,
	`share_token` text NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`items_json` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_reports_share_token_unique` ON `saved_reports` (`share_token`);