import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { generateAccessToken, hashAccessToken } from '../auth/token';
import { CreatePlayerDto } from './dto/create-player.dto';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { decryptSecret, encryptSecret } from '../auth/secret-box';
import { UpdatePlayerDto } from './dto/update-player.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly config: ConfigService,
  ) {}

  private encryptionKey(): string {
    const value = this.config.get<string>('APP_ENCRYPTION_KEY');
    if (!value || value.length < 32)
      throw new Error('APP_ENCRYPTION_KEY must contain at least 32 characters');
    return value;
  }

  async createPlayer(dto: CreatePlayerDto) {
    const accessToken = generateAccessToken();
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone,
        tokenHash: hashAccessToken(accessToken),
        tokenEncrypted: encryptSecret(accessToken, this.encryptionKey()),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
        cards: {
          select: { id: true, number: true, serial: true },
          orderBy: { number: 'asc' },
        },
      },
    });
    const accessLink = await this.whatsapp.notifyPlayerAccess({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone!,
      },
      accessToken,
    });
    return { ...user, accessToken, accessLink };
  }

  listPlayers() {
    return this.prisma.user.findMany({
      where: { role: 'PLAYER' },
      select: {
        id: true,
        name: true,
        phone: true,
        active: true,
        createdAt: true,
        cards: {
          select: { id: true, number: true, serial: true },
          orderBy: { number: 'asc' },
        },
        whatsappDeliveries: {
          where: { kind: 'PLAYER_ACCESS' },
          select: { status: true, updatedAt: true, error: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePlayer(id: string, dto: UpdatePlayerDto) {
    const existing = await this.prisma.user.findFirst({
      where: { id, role: 'PLAYER' },
    });
    if (!existing) throw new NotFoundException('Player not found');
    return this.prisma.user.update({
      where: { id },
      data: { ...dto, name: dto.name?.trim() },
      select: { id: true, name: true, phone: true, active: true },
    });
  }

  private async playerWithToken(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: 'PLAYER' },
      select: { id: true, name: true, phone: true, tokenEncrypted: true },
    });
    if (!user) throw new NotFoundException('Player not found');
    if (!user.tokenEncrypted) return null;
    return {
      ...user,
      accessToken: decryptSecret(user.tokenEncrypted, this.encryptionKey()),
    };
  }

  async getAccessLink(id: string) {
    const user = await this.playerWithToken(id);
    if (!user) return this.regenerateAccessLink(id);
    return { accessLink: await this.whatsapp.accessLink(user.accessToken) };
  }

  async regenerateAccessLink(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: 'PLAYER' },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Player not found');
    const accessToken = generateAccessToken();
    await this.prisma.user.update({
      where: { id },
      data: {
        tokenHash: hashAccessToken(accessToken),
        tokenEncrypted: encryptSecret(accessToken, this.encryptionKey()),
      },
    });
    return { accessLink: await this.whatsapp.accessLink(accessToken) };
  }

  async sendAccessLink(id: string) {
    let user = await this.playerWithToken(id);
    if (!user) {
      await this.regenerateAccessLink(id);
      user = await this.playerWithToken(id);
    }
    if (!user?.phone) throw new NotFoundException('Player phone not found');
    const accessLink = await this.whatsapp.notifyPlayerAccess({
      user: { id: user.id, name: user.name, phone: user.phone },
      accessToken: user.accessToken,
    });
    return { accessLink };
  }
}
