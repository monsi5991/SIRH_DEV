-- Add explicit Keycloak identity binding on app users.
ALTER TABLE "User"
ADD COLUMN "keycloakSub" TEXT,
ADD COLUMN "keycloakIssuer" TEXT;

CREATE INDEX "User_keycloakSub_idx" ON "User"("keycloakSub");

CREATE UNIQUE INDEX "User_keycloakIssuer_keycloakSub_key"
ON "User"("keycloakIssuer", "keycloakSub");
