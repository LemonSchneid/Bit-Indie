let withSentryConfig;
try {
  ({ withSentryConfig } = require("@sentry/nextjs"));
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") {
    throw error;
  }
  withSentryConfig = (config) => config;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },
};

const sentryWebpackPluginOptions = {
  silent: true,
};

const sentryBuildOptions = {
  hideSourcemaps: true,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions, sentryBuildOptions);
