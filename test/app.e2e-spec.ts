import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Shbash E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Tokens and IDs shared across tests
  let adminToken: string;
  let userToken: string;
  let categoryId: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same pipes as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    // Clean database before all tests
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  // ==========================================================================
  // AUTH FLOW
  // ==========================================================================

  describe('Auth Flow', () => {
    describe('POST /auth/register', () => {
      it('should register a new user', async () => {
        const res = await supertest(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: 'user@shbash.co',
            password: 'Password123!',
            name: 'Test User',
          })
          .expect(201);

        expect(res.body).toHaveProperty('email', 'user@shbash.co');
        expect(res.body).not.toHaveProperty('password');
      });

      it('should register an admin user', async () => {
        const res = await supertest(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: 'admin@shbash.co',
            password: 'Admin123!',
            name: 'Admin User',
          })
          .expect(201);

        expect(res.body).toHaveProperty('email', 'admin@shbash.co');

        // Manually promote to admin for testing
        await prisma.user.update({
          where: { email: 'admin@shbash.co' },
          data: { role: 'ADMIN' },
        });
      });

      it('should reject duplicate email with 409', async () => {
        await supertest(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: 'user@shbash.co',
            password: 'Password123!',
            name: 'Duplicate User',
          })
          .expect(409);
      });

      it('should reject weak password with 400', async () => {
        await supertest(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: 'weak@shbash.co',
            password: '123',
            name: 'Weak User',
          })
          .expect(400);
      });
    });

    describe('POST /auth/login', () => {
      it('should login user and return token', async () => {
        const res = await supertest(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'user@shbash.co',
            password: 'Password123!',
          })
          .expect(200);

        expect(res.body).toHaveProperty('access_token');
        userToken = res.body.access_token;
      });

      it('should login admin and return token', async () => {
        const res = await supertest(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'admin@shbash.co',
            password: 'Admin123!',
          })
          .expect(200);

        expect(res.body).toHaveProperty('access_token');
        expect(res.body.user.role).toBe('ADMIN');
        adminToken = res.body.access_token;
      });

      it('should reject wrong password with 401', async () => {
        await supertest(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'user@shbash.co',
            password: 'WrongPassword!',
          })
          .expect(401);
      });
    });

    describe('GET /auth/me', () => {
      it('should return current user profile', async () => {
        const res = await supertest(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('email', 'user@shbash.co');
        expect(res.body).not.toHaveProperty('password');
      });

      it('should reject unauthenticated request with 401', async () => {
        await supertest(app.getHttpServer())
          .get('/auth/me')
          .expect(401);
      });
    });
  });

  // ==========================================================================
  // CATEGORY FLOW
  // ==========================================================================

  describe('Category Flow', () => {
    describe('POST /categories', () => {
      it('should create a category as admin', async () => {
        const res = await supertest(app.getHttpServer())
          .post('/categories')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'Stickers' })
          .expect(201);

        expect(res.body).toHaveProperty('name', 'Stickers');
        categoryId = res.body.id;
      });

      it('should reject duplicate category name with 409', async () => {
        await supertest(app.getHttpServer())
          .post('/categories')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'Stickers' })
          .expect(409);
      });

      it('should reject non-admin with 403', async () => {
        await supertest(app.getHttpServer())
          .post('/categories')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ name: 'Clothing' })
          .expect(403);
      });
    });

    describe('GET /categories', () => {
      it('should return all categories publicly', async () => {
        const res = await supertest(app.getHttpServer())
          .get('/categories')
          .expect(200);

        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toHaveProperty('name', 'Stickers');
      });
    });

    describe('GET /categories/:id', () => {
      it('should return a single category with products', async () => {
        const res = await supertest(app.getHttpServer())
          .get(`/categories/${categoryId}`)
          .expect(200);

        expect(res.body).toHaveProperty('name', 'Stickers');
        expect(res.body).toHaveProperty('products');
      });

      it('should return 404 for non-existent category', async () => {
        await supertest(app.getHttpServer())
          .get('/categories/non-existent-id')
          .expect(404);
      });
    });
  });

  // ==========================================================================
  // PRODUCT FLOW
  // ==========================================================================

  describe('Product Flow', () => {
    describe('POST /products', () => {
      it('should create a product as admin', async () => {
        const res = await supertest(app.getHttpServer())
          .post('/products')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Victorious XIII',
            description: 'Limited edition streetwear',
            price: 6.5,
            stock: 10,
            images: ['https://res.cloudinary.com/demo/image/upload/v1/shbash/p1.jpg'],
            categoryId,
          })
          .expect(201);

        expect(res.body).toHaveProperty('name', 'Victorious XIII');
        expect(res.body).toHaveProperty('price', 6.5);
        productId = res.body.id;
      });

      it('should reject non-admin with 403', async () => {
        await supertest(app.getHttpServer())
          .post('/products')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            name: 'Unauthorized Product',
            price: 5,
            stock: 1,
            images: [],
            categoryId,
          })
          .expect(403);
      });
    });

    describe('GET /products', () => {
      it('should return paginated products publicly', async () => {
        const res = await supertest(app.getHttpServer())
          .get('/products')
          .expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveLength(1);
        expect(res.body).toHaveProperty('meta');
      });

      it('should filter by categoryId', async () => {
        const res = await supertest(app.getHttpServer())
          .get(`/products?categoryId=${categoryId}`)
          .expect(200);

        expect(res.body.data).toHaveLength(1);
      });

      it('should filter by search term', async () => {
        const res = await supertest(app.getHttpServer())
          .get('/products?search=victorious')
          .expect(200);

        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].name).toBe('Victorious XIII');
      });
    });

    describe('GET /products/:id', () => {
      it('should return a single product', async () => {
        const res = await supertest(app.getHttpServer())
          .get(`/products/${productId}`)
          .expect(200);

        expect(res.body).toHaveProperty('name', 'Victorious XIII');
      });

      it('should return 404 for non-existent product', async () => {
        await supertest(app.getHttpServer())
          .get('/products/non-existent-id')
          .expect(404);
      });
    });

    describe('PATCH /products/:id', () => {
      it('should update a product as admin', async () => {
        const res = await supertest(app.getHttpServer())
          .patch(`/products/${productId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ price: 7.5 })
          .expect(200);

        expect(res.body).toHaveProperty('price', 7.5);
      });
    });
  });

  // ==========================================================================
  // CART FLOW
  // ==========================================================================

  describe('Cart Flow', () => {
    describe('POST /cart/add', () => {
      it('should add item to cart', async () => {
        const res = await supertest(app.getHttpServer())
          .post('/cart/add')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ productId, quantity: 2 })
          .expect(201);

        expect(res.body).toHaveProperty('productId', productId);
        expect(res.body).toHaveProperty('quantity', 2);
      });

      it('should reject quantity exceeding stock with 400', async () => {
        await supertest(app.getHttpServer())
          .post('/cart/add')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ productId, quantity: 999 })
          .expect(400);
      });

      it('should reject unauthenticated request with 401', async () => {
        await supertest(app.getHttpServer())
          .post('/cart/add')
          .send({ productId, quantity: 1 })
          .expect(401);
      });
    });

    describe('GET /cart', () => {
      it('should return cart with total', async () => {
        const res = await supertest(app.getHttpServer())
          .get('/cart')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('items');
        expect(res.body).toHaveProperty('total');
        expect(res.body.items).toHaveLength(1);
        expect(res.body.total).toBe(15); // 2 * 7.5
      });
    });

    describe('DELETE /cart/remove/:productId', () => {
      it('should remove item from cart', async () => {
        await supertest(app.getHttpServer())
          .delete(`/cart/remove/${productId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        // Verify cart is empty
        const cart = await supertest(app.getHttpServer())
          .get('/cart')
          .set('Authorization', `Bearer ${userToken}`);

        expect(cart.body.items).toHaveLength(0);
      });
    });
  });

  // ==========================================================================
  // ORDER FLOW
  // ==========================================================================

  describe('Order Flow', () => {
    let orderId: string;

    it('should add item to cart before checkout', async () => {
      await supertest(app.getHttpServer())
        .post('/cart/add')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 1 })
        .expect(201);
    });

    describe('POST /orders/checkout', () => {
      it('should create an order from cart', async () => {
        const res = await supertest(app.getHttpServer())
          .post('/orders/checkout')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(201);

        expect(res.body).toHaveProperty('status', 'PENDING');
        expect(res.body).toHaveProperty('total');
        expect(res.body.total).toBe(7.5);
        orderId = res.body.id;
      });

      it('should decrement product stock after checkout', async () => {
        const res = await supertest(app.getHttpServer())
          .get(`/products/${productId}`)
          .expect(200);

        expect(res.body.stock).toBe(9); // was 10, bought 1
      });

      it('should clear cart after checkout', async () => {
        const res = await supertest(app.getHttpServer())
          .get('/cart')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(res.body.items).toHaveLength(0);
      });

      it('should reject checkout with empty cart with 400', async () => {
        await supertest(app.getHttpServer())
          .post('/orders/checkout')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(400);
      });

      it('should return same order on duplicate idempotency key', async () => {
        // Add to cart first
        await supertest(app.getHttpServer())
          .post('/cart/add')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ productId, quantity: 1 });

        const res1 = await supertest(app.getHttpServer())
          .post('/orders/checkout')
          .set('Authorization', `Bearer ${userToken}`)
          .set('x-idempotency-key', 'unique-key-abc')
          .expect(201);

        const res2 = await supertest(app.getHttpServer())
          .post('/orders/checkout')
          .set('Authorization', `Bearer ${userToken}`)
          .set('x-idempotency-key', 'unique-key-abc')
          .expect(201);

        expect(res1.body.id).toBe(res2.body.id);
      });
    });

    describe('GET /orders', () => {
      it('should return user orders with pagination', async () => {
        const res = await supertest(app.getHttpServer())
          .get('/orders')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body.data.length).toBeGreaterThan(0);
      });
    });

    describe('PATCH /orders/:id/status', () => {
      it('should update order status as admin', async () => {
        const res = await supertest(app.getHttpServer())
          .patch(`/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'SHIPPED' })
          .expect(200);

        expect(res.body).toHaveProperty('status', 'SHIPPED');
      });

      it('should reject invalid status transition with 400', async () => {
        await supertest(app.getHttpServer())
          .patch(`/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'PENDING' })
          .expect(400);
      });

      it('should reject non-admin with 403', async () => {
        await supertest(app.getHttpServer())
          .patch(`/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ status: 'COMPLETED' })
          .expect(403);
      });
    });

    describe('GET /orders/admin/stats', () => {
      it('should return admin stats', async () => {
        const res = await supertest(app.getHttpServer())
          .get('/orders/admin/stats')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('totalRevenue');
        expect(res.body).toHaveProperty('totalOrders');
        expect(res.body).toHaveProperty('totalProducts');
      });
    });
  });
});