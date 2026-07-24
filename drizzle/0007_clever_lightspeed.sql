CREATE TABLE `dismissed_catalysts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`catalyst_id` integer NOT NULL,
	`dismissed_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`catalyst_id`) REFERENCES `catalysts`(`id`) ON UPDATE no action ON DELETE no action
);
