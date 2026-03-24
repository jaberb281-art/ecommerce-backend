import { Test, TestingModule } from '@nestjs/testing';
import { ShopSettingsService } from './shop-settings.service';

describe('ShopSettingsService', () => {
  let service: ShopSettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShopSettingsService],
    }).compile();

    service = module.get<ShopSettingsService>(ShopSettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
