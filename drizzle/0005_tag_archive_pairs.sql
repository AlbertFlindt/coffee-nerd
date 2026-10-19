CREATE TABLE `tag_merged` (
	`tag_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`into_tag_id` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tag_pair_kept` (
	`owner_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`other_tag_id` text NOT NULL,
	PRIMARY KEY(`tag_id`, `other_tag_id`),
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`other_tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `tag` ADD `archived_at` integer;