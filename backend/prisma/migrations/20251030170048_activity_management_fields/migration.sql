-- AlterTable
ALTER TABLE `activity` ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `mentorId` INTEGER NULL,
    ADD COLUMN `posterSizeBytes` INTEGER NULL,
    ADD COLUMN `posterUrl` VARCHAR(191) NULL DEFAULT '',
    ADD COLUMN `qqGroupQrSizeBytes` INTEGER NULL,
    ADD COLUMN `qqGroupQrUrl` VARCHAR(191) NULL DEFAULT '',
    ADD COLUMN `registerDeadline` DATETIME(3) NULL,
    ADD COLUMN `startAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Activity_mentorId_idx` ON `Activity`(`mentorId`);

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_mentorId_fkey` FOREIGN KEY (`mentorId`) REFERENCES `Mentor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
