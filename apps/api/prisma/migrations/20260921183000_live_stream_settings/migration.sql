CREATE TABLE "LiveStreamSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "youtubeVideoId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveStreamSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LiveStreamSettings_singleton" CHECK ("id" = 1)
);
