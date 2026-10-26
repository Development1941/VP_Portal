import type { NextConfig } from "next";
 
type CacheCompiler = {
  hooks: {
    infrastructureLog: {
      tap: (name: string, fn: (origin: string, type: string, args: unknown[]) => true | undefined) => void;
    };
  };
};

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@supabase/ssr", "@supabase/supabase-js", "@supabase/auth-js", "@supabase/storage-js", "xlsx"],
  webpack: (config) => {
    config.plugins.push({
      apply(compiler: CacheCompiler) {
        compiler.hooks.infrastructureLog.tap("quiet-cache-strings", (_name, type, args) => {
          if (type === "warn" && args.some((arg) => typeof arg === "string" && arg.includes("Serializing big strings"))) return true;
          return undefined;
        });
      },
    });
    return config;
  },
  experimental: {
    devtoolSegmentExplorer: false,
    optimizePackageImports: ["lucide-react"],
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
