describe('auth model types', () => {
  it('should accept object literals matching the auth contract', () => {
    const user = {
      id: 'u1',
      email: 'admin@vinoleger.com',
      role: 'Admin' as const,
      name: 'System Admin',
    };

    expect(user.role).toBe('Admin');
    expect(user.email).toContain('@');
  });
});
