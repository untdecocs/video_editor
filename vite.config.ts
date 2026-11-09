import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { evaluateReadiness } from './scripts/readiness.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'stillwave-production-release-gate',
      async configResolved(config) {
        if (config.command !== 'build' || config.mode === 'preview') return;
        if (!['production', 'private-beta'].includes(config.mode)) {
          throw new Error(
            `Stillwave build mode "${config.mode}" is not approved. Use preview for non-release builds or a gated production/private-beta mode.`,
          );
        }
        const readJson = (relativePath: string) => JSON.parse(
          readFileSync(resolve(config.root, relativePath), 'utf8'),
        ) as Record<string, unknown>;
        const production = readJson('config/production.json');
        const release = readJson('config/release-readiness.json');
        const media = readJson('config/media-limits.json');
        const packageInfo = readJson('package.json');
        const approvalEnvironment = loadEnv(config.mode, config.root, 'RELEASE_');
        const requestedMode = config.mode === 'production' ? 'PUBLIC' : 'PRIVATE_BETA';
        const evaluation = evaluateReadiness({
          production,
          release,
          media,
          appVersion: String(packageInfo.version ?? ''),
          authorizedApprovers: approvalEnvironment.RELEASE_AUTHORIZED_APPROVERS,
          authorizedPrivacyReviewers: approvalEnvironment.RELEASE_AUTHORIZED_PRIVACY_REVIEWERS,
          authorizedMediaApprovers: approvalEnvironment.RELEASE_AUTHORIZED_MEDIA_APPROVERS,
        });
        if (evaluation.mode !== requestedMode || !evaluation.eligible) {
          const blockers = Object.entries(evaluation.checks)
            .filter(([, result]) => result.status !== 'ready')
            .map(([key, result]) => `${key}: ${result.detail}`);
          throw new Error(
            `Stillwave ${requestedMode} build blocked. Release mode must be ${requestedMode} and every required gate must pass.\n${blockers.map((item) => `- ${item}`).join('\n')}`,
          );
        }
      },
    },
  ],
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
