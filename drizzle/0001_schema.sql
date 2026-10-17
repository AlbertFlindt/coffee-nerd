CREATE TABLE `app_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`current_bean_id` text,
	`brew_next_recipe_id` text,
	`home_graph` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`current_bean_id`) REFERENCES `bean`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`brew_next_recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bean` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`shared` integer DEFAULT false NOT NULL,
	`rebuy_of_id` text,
	`name` text NOT NULL,
	`roaster` text,
	`region` text,
	`variety` text,
	`country_code` text,
	`process` text,
	`altitude_min_m` integer,
	`altitude_max_m` integer,
	`roast_level` text,
	`roast_date` text NOT NULL,
	`bag_weight` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`finished_at` integer,
	`finished_automatically` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rebuy_of_id`) REFERENCES `bean`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bean_owner` ON `bean` (`owner_id`);--> statement-breakpoint
CREATE TABLE `gear` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`shared` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`spec` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `gear_owner` ON `gear` (`owner_id`);--> statement-breakpoint
CREATE TABLE `prep_step` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`shared` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`name` text NOT NULL,
	`setting` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `prep_step_owner` ON `prep_step` (`owner_id`);--> statement-breakpoint
CREATE TABLE `recipe` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`method` text DEFAULT 'espresso' NOT NULL,
	`bean_id` text NOT NULL,
	`machine_id` text NOT NULL,
	`grinder_id` text NOT NULL,
	`basket_id` text,
	`routine_id` text,
	`grind` integer NOT NULL,
	`dose` integer NOT NULL,
	`setup` text NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bean_id`) REFERENCES `bean`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`machine_id`) REFERENCES `gear`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grinder_id`) REFERENCES `gear`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`basket_id`) REFERENCES `gear`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`routine_id`) REFERENCES `routine`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_identity` ON `recipe` (`owner_id`,`bean_id`,`machine_id`,`fingerprint`);--> statement-breakpoint
CREATE TABLE `routine` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`shared` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`name` text NOT NULL,
	`steps` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `routine_owner` ON `routine` (`owner_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_user` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `shot` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`brewed_at` integer NOT NULL,
	`yield` integer,
	`time` integer,
	`score` integer,
	`balance` integer,
	`body` integer,
	`sweetness` integer,
	`aftertaste` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shot_owner_brewed` ON `shot` (`owner_id`,`brewed_at`);--> statement-breakpoint
CREATE INDEX `shot_recipe` ON `shot` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `shot_tag` (
	`shot_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`shot_id`, `tag_id`),
	FOREIGN KEY (`shot_id`) REFERENCES `shot`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shot_tag_tag` ON `shot_tag` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`shared` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`family` text NOT NULL,
	`built_in` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_owner_name` ON `tag` (`owner_id`,lower("name"));--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`default_machine_id` text,
	`default_grinder_id` text,
	`default_basket_id` text,
	`default_routine_id` text,
	`default_grind` integer,
	`default_dose` integer,
	`default_yield` integer,
	`default_features` text DEFAULT '{}' NOT NULL,
	`time_zone` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`default_machine_id`) REFERENCES `gear`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`default_grinder_id`) REFERENCES `gear`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`default_basket_id`) REFERENCES `gear`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`default_routine_id`) REFERENCES `routine`(`id`) ON UPDATE no action ON DELETE no action
);
