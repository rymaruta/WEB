-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "photo" JSONB,
ADD COLUMN     "photoCheckedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EntityPhoto" (
    "name" TEXT NOT NULL,
    "url" TEXT,
    "page" TEXT,
    "credit" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityPhoto_pkey" PRIMARY KEY ("name")
);

