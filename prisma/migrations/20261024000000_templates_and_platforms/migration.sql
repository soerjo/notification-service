-- DropForeignKey
ALTER TABLE IF EXISTS "users" DROP CONSTRAINT IF EXISTS "users_organizationId_fkey";

-- DropTable
DROP TABLE IF EXISTS "users";
DROP TABLE IF EXISTS "organizations";

-- DropEnum
DROP TYPE IF EXISTS "RoleName";

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_platforms" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "templates" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "subject" VARCHAR(255),
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "templates_code_channel_key" ON "templates"("code", "channel");
