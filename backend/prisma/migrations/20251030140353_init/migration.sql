-- CreateTable
CREATE TABLE `ActivityRegistration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activityId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('REGISTERED', 'CANCELED') NOT NULL DEFAULT 'REGISTERED',
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `canceledAt` DATETIME(3) NULL,

    INDEX `ActivityRegistration_userId_idx`(`userId`),
    UNIQUE INDEX `ActivityRegistration_activityId_userId_key`(`activityId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ActivityRegistration` ADD CONSTRAINT `ActivityRegistration_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityRegistration` ADD CONSTRAINT `ActivityRegistration_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
