import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Explicitly lock the Turbopack search root to the frontend folder
    root: path.join(__dirname),
  },
};

export default nextConfig;
