/*
  Warnings:

  - You are about to drop the column `CreatedAt` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `updateAt` on the `Post` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "CreatedAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "updateAt",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
