CREATE TABLE `nyse_listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`display_symbol` text NOT NULL,
	`description` text,
	`mic` text,
	`type` text,
	`currency` text,
	`last_price` text,
	`quoted_at` text,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nyse_listings_symbol_unique` ON `nyse_listings` (`symbol`);
