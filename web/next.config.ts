import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // 关闭右下角英文调试浮标（Next.js内置开发工具）
  devIndicators: false,
};

export default nextConfig;
