export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/admin',
    },
    sitemap: 'https://aayushkumaryadav.com.np/sitemap.xml',
  };
}
