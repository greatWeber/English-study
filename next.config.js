/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Transformers.js 依赖原生 onnxruntime-node，必须保持外部依赖，不要被 webpack 打包
    serverComponentsExternalPackages: ['@huggingface/transformers', 'onnxruntime-node'],
  },
}

module.exports = nextConfig
