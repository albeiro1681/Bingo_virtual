import { BadRequestException, Injectable } from '@nestjs/common';
import { DrawsGateway } from '../draws/draws.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLiveStreamSettingsDto } from './dto/update-live-stream-settings.dto';

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export function youtubeVideoId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !YOUTUBE_HOSTS.has(url.hostname)) {
    return null;
  }

  const parts = url.pathname.split('/').filter(Boolean);
  const candidate =
    url.hostname === 'youtu.be' || url.hostname === 'www.youtu.be'
      ? parts[0]
      : url.pathname === '/watch'
        ? url.searchParams.get('v')
        : ['live', 'embed', 'shorts'].includes(parts[0] ?? '')
          ? parts[1]
          : null;

  return candidate && YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null;
}

@Injectable()
export class LiveStreamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: DrawsGateway,
  ) {}

  async getSettings() {
    const stored = await this.prisma.liveStreamSettings.findUnique({
      where: { id: 1 },
    });
    return this.publicSettings(stored ?? undefined);
  }

  async updateSettings(dto: UpdateLiveStreamSettingsDto) {
    const current = await this.prisma.liveStreamSettings.findUnique({
      where: { id: 1 },
    });
    let videoId = current?.youtubeVideoId ?? null;

    if (dto.youtubeUrl !== undefined) {
      const trimmed = dto.youtubeUrl.trim();
      videoId = trimmed ? youtubeVideoId(trimmed) : null;
      if (trimmed && !videoId) {
        throw new BadRequestException(
          'Ingresa un enlace válido de video o transmisión de YouTube',
        );
      }
    }

    const enabled = dto.enabled ?? current?.enabled ?? false;
    if (enabled && !videoId) {
      throw new BadRequestException(
        'Debes configurar un enlace de YouTube antes de mostrar la transmisión',
      );
    }

    const stored = await this.prisma.liveStreamSettings.upsert({
      where: { id: 1 },
      create: { id: 1, youtubeVideoId: videoId, enabled },
      update: { youtubeVideoId: videoId, enabled },
    });
    const settings = this.publicSettings(stored);
    this.gateway.liveStreamUpdated(settings);
    return settings;
  }

  private publicSettings(stored?: {
    youtubeVideoId: string | null;
    enabled: boolean;
    updatedAt: Date;
  }) {
    const youtubeVideoId = stored?.youtubeVideoId ?? null;
    return {
      enabled: Boolean(stored?.enabled && youtubeVideoId),
      youtubeVideoId,
      youtubeUrl: youtubeVideoId
        ? `https://www.youtube.com/watch?v=${youtubeVideoId}`
        : '',
      updatedAt: stored?.updatedAt ?? null,
    };
  }
}
