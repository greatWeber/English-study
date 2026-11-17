/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node', 'msedge-tts', 'ws'],
}

module.exports = nextConfig
