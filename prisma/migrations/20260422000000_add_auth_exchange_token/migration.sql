-- CreateTable
CREATE TABLE "AuthExchangeToken" (
    "id" TEXT NOT NULL,
    "ticket" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthExchangeToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthExchangeToken_ticket_key" ON "AuthExchangeToken"("ticket");

-- CreateIndex
CREATE INDEX "AuthExchangeToken_expiresAt_idx" ON "AuthExchangeToken"("expiresAt");