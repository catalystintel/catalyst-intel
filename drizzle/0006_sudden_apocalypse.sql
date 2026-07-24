CREATE TABLE `alert_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alert_rule_id` integer NOT NULL,
	`catalyst_id` integer NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`alert_rule_id`) REFERENCES `alert_rules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`catalyst_id`) REFERENCES `catalysts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `event_clusters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticker` text NOT NULL,
	`category` text,
	`window_start` text NOT NULL,
	`window_end` text NOT NULL,
	`member_count` integer DEFAULT 1 NOT NULL,
	`primary_catalyst_id` integer,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `catalysts` ADD `ticker_source` text;--> statement-breakpoint
ALTER TABLE `catalysts` ADD `sentiment` text;--> statement-breakpoint
ALTER TABLE `catalysts` ADD `sentiment_reasoning` text;--> statement-breakpoint
ALTER TABLE `catalysts` ADD `materiality_reasons` text;--> statement-breakpoint
ALTER TABLE `catalysts` ADD `session_context` text;--> statement-breakpoint
ALTER TABLE `catalysts` ADD `ai_bullets` text;--> statement-breakpoint
ALTER TABLE `catalysts` ADD `ai_lean` text;--> statement-breakpoint
ALTER TABLE `catalysts` ADD `ai_uncertain` integer;--> statement-breakpoint
ALTER TABLE `catalysts` ADD `cluster_id` integer REFERENCES event_clusters(id);--> statement-breakpoint
ALTER TABLE `companies` ADD `exchange` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `logo_url` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `enriched_at` text;
