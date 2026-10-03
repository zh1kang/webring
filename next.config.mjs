import {fileURLToPath} from 'node:url';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default {
  output: 'export',
  turbopack: {root: fileURLToPath(new URL('.', import.meta.url))},
  devIndicators: false,
  basePath,
  trailingSlash: true,
  images: {unoptimized: true},
};
