/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 浏览器回归测试使用独立构建目录，避免与本地 dev server 的 .next 相互覆盖
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Transformers.js 依赖原生 onnxruntime-node，必须保持外部依赖，不要被 webpack 打包
    // msedge-tts/ws 被 webpack 打包后 bufferUtil 会丢失，同样必须外部化
    serverComponentsExternalPackages: ['@huggingface/transformers', 'onnxruntime-node', 'msedge-tts', 'ws'],
  },
}

module.exports = nextConfig
