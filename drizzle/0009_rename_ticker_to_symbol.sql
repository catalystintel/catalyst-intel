ALTER TABLE `companies` RENAME COLUMN `ticker` TO `symbol`;--> statement-breakpoint
DROP INDEX IF EXISTS `companies_ticker_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `companies_symbol_unique` ON `companies` (`symbol`);--> statement-breakpoint
ALTER TABLE `catalysts` RENAME COLUMN `ticker` TO `symbol`;--> statement-breakpoint
ALTER TABLE `catalysts` RENAME COLUMN `ticker_source` TO `symbol_source`;--> statement-breakpoint
ALTER TABLE `event_clusters` RENAME COLUMN `ticker` TO `symbol`;--> statement-breakpoint
ALTER TABLE `watchlist_entries` RENAME COLUMN `ticker` TO `symbol`;
