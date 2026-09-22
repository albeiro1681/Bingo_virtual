import { BadRequestException } from '@nestjs/common';
import type { DrawsGateway } from '../draws/draws.gateway';
import type { PrismaService } from '../prisma/prisma.service';
import { LiveStreamService, youtubeVideoId } from './live-stream.service';

describe('youtubeVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=12', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('extracts the id from %s', (url, expected) => {
    expect(youtubeVideoId(url)).toBe(expected);
  });

  it.each([
    'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.example.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/channel/example/live',
    'not-a-url',
  ])('rejects unsupported or unsafe values: %s', (url) => {
    expect(youtubeVideoId(url)).toBeNull();
  });
});

describe('LiveStreamService', () => {
  const findUnique = jest.fn();
  const upsert = jest.fn();
  const liveStreamUpdated = jest.fn();
  const prisma = {
    liveStreamSettings: { findUnique, upsert },
  } as unknown as PrismaService;
  const gateway = { liveStreamUpdated } as unknown as DrawsGateway;
  const service = new LiveStreamService(prisma, gateway);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a disabled default when settings do not exist', async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.getSettings()).resolves.toEqual({
      enabled: false,
      youtubeVideoId: null,
      youtubeUrl: '',
      updatedAt: null,
    });
  });

  it('stores a validated YouTube id and notifies connected clients', async () => {
    const updatedAt = new Date('2026-09-21T18:30:00.000Z');
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({
      id: 1,
      youtubeVideoId: 'dQw4w9WgXcQ',
      enabled: true,
      updatedAt,
    });

    const result = await service.updateSettings({
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      enabled: true,
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: {
        id: 1,
        youtubeVideoId: 'dQw4w9WgXcQ',
        enabled: true,
      },
      update: { youtubeVideoId: 'dQw4w9WgXcQ', enabled: true },
    });
    expect(result).toEqual({
      enabled: true,
      youtubeVideoId: 'dQw4w9WgXcQ',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      updatedAt,
    });
    expect(liveStreamUpdated).toHaveBeenCalledWith(result);
  });

  it('does not enable the player without a valid video', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.updateSettings({ youtubeUrl: '', enabled: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });
});
