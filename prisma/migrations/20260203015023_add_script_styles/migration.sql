-- CreateTable
CREATE TABLE "script_styles" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_styles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "script_styles_isActive_order_idx" ON "script_styles"("isActive", "order");
