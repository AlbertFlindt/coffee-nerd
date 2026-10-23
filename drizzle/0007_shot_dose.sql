DROP INDEX `recipe_identity`;--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_identity_dose` ON `recipe` (`owner_id`,`bean_id`,`machine_id`,`fingerprint`,`dose`);--> statement-breakpoint
ALTER TABLE `shot` ADD `dose` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- D-186: each shot keeps the dose it was brewed with, which until now was its recipe's.
UPDATE `shot` SET `dose` = (SELECT `recipe`.`dose` FROM `recipe` WHERE `recipe`.`id` = `shot`.`recipe_id`);
