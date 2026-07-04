import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // pptxgenjs(클라이언트 PPT 렌더러)가 node:fs 등을 조건부 import한다.
      // 브라우저 번들에서는 node: 스킴을 벗기고 해당 모듈을 빈 모듈로 대체.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, "");
          },
        ),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
        os: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
