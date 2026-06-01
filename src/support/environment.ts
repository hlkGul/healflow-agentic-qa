export type Environment = 'dev' | 'prod';

interface EnvironmentConfig {
  baseUrl: string;
  domain: string;
}

const ENVIRONMENTS: Record<Environment, EnvironmentConfig> = {
  dev: {
    baseUrl: 'https://web-dev.modanisa.net',
    domain: '.modanisa.net',
  },
  prod: {
    baseUrl: 'https://www.modanisa.com',
    domain: '.modanisa.com',
  },
};

/**
 * Resolves the current environment from `TEST_ENV` env variable.
 * Defaults to 'prod' if not set.
 */
export function getEnvironment(): Environment {
  const env = process.env['TEST_ENV']?.toLowerCase().trim();
  if (env === 'dev' || env === 'prod') return env;
  return 'prod';
}

export function getConfig(): EnvironmentConfig {
  return ENVIRONMENTS[getEnvironment()];
}

export function getBaseUrl(): string {
  return getConfig().baseUrl;
}

export function getDomain(): string {
  return getConfig().domain;
}
