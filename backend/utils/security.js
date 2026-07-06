const crypto = require('crypto');

const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
};

const getCredentialKey = () => {
  const secret = process.env.STREAMING_CREDENTIALS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('STREAMING_CREDENTIALS_SECRET or JWT_SECRET is required for credential encryption.');
  }
  return crypto.createHash('sha256').update(secret).digest();
};

const encryptText = (plainText) => {
  const value = String(plainText || '');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCredentialKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptText = (value) => {
  if (!value || typeof value !== 'string' || !value.startsWith('enc:v1:')) {
    return value;
  }

  const [, , ivB64, tagB64, encryptedB64] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getCredentialKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
};

module.exports = {
  decryptText,
  encryptText,
  getCookieOptions,
};
