const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com",
      },
    ],
  },
};

const sentryWebpackPluginOptions = {
  silent: true,
};

const sentryBuildOptions = {
  hideSourcemaps: true,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions, sentryBuildOptions);
