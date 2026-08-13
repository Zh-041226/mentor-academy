-- Add promo link and image fields to Activity
ALTER TABLE `Activity`
  ADD COLUMN `promoLinkUrl` VARCHAR(191) NULL DEFAULT '' AFTER `qqGroupQrSizeBytes`,
  ADD COLUMN `promoImageUrl` VARCHAR(191) NULL DEFAULT '' AFTER `promoLinkUrl`,
  ADD COLUMN `promoImageSizeBytes` INT NULL AFTER `promoImageUrl`;