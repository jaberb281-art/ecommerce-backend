import { Test, TestingModule } from '@nestjs/testing';
import { ShopSettingsController } from './shop-settings.controller';

describe('ShopSettingsController', () => {
  let controller: ShopSettingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShopSettingsController],
    }).compile();

    controller = module.get<ShopSettingsController>(ShopSettingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
