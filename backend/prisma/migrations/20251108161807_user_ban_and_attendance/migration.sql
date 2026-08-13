-- AlterTable
ALTER TABLE `activityregistration` ADD COLUMN `attended` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `markedAt` DATETIME(3) NULL,
    ADD COLUMN `noShow` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `bannedCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `bannedNote` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `bannedUntil` DATETIME(3) NULL;
