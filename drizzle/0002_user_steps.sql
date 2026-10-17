ALTER TABLE `user_settings` ADD `dose_step` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `yield_step` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `time_step` integer DEFAULT 1000 NOT NULL;