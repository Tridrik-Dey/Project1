import { featureFlags } from "../config/featureFlags";

type RevampFeature = keyof typeof featureFlags;

type ResolveApiPathOptions = {
  legacyPath: string;
  revampPath?: string;
  feature?: RevampFeature;
};

function normalize(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function resolveApiPath(options: ResolveApiPathOptions): string {
  const legacyPath = normalize(options.legacyPath);
  const revampPath = options.revampPath ? normalize(options.revampPath) : legacyPath;
  const featureEnabled = options.feature ? featureFlags[options.feature] : false;
  return featureEnabled ? revampPath : legacyPath;
}

