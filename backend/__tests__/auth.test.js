const { hashPassword, verifyPassword, createToken, verifyToken } = require('../src/services/auth');

describe('Auth Service', () => {
  describe('Password hashing', () => {
    it('should hash password', async () => {
      const password = 'Test123!';
      const hash = await hashPassword(password);
      expect(hash).not.toEqual(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it('should verify correct password', async () => {
      const password = 'Test123!';
      const hash = await hashPassword(password);
      const valid = await verifyPassword(password, hash);
      expect(valid).toBe(true);
    });

    it('should reject invalid password', async () => {
      const password = 'Test123!';
      const hash = await hashPassword(password);
      const valid = await verifyPassword('WrongPassword', hash);
      expect(valid).toBe(false);
    });
  });

  describe('JWT tokens', () => {
    it('should create valid token', () => {
      const userId = 123;
      const token = createToken(userId);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should verify valid token', () => {
      const userId = 456;
      const token = createToken(userId);
      const payload = verifyToken(token);
      expect(payload).toBeTruthy();
      expect(payload.userId).toBe(userId);
    });

    it('should reject invalid token', () => {
      const payload = verifyToken('invalid.token.here');
      expect(payload).toBeNull();
    });
  });
});
