import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_SERVICES = ['api', 'worker', 'web'];
const PRIVATE_SERVICES = ['postgres', 'api', 'worker'];
const RUNTIME_TARGETS = ['api', 'web', 'worker', 'tools'];

function serviceBlock(compose, service) {
  const match = compose.match(
    new RegExp(
      `(?:^|\\n)  ${service}:\\r?\\n([\\s\\S]*?)(?=\\n  [A-Za-z0-9_-]+:\\r?\\n|\\nvolumes:\\r?\\n|$)`,
    ),
  );
  return match?.[1];
}

function targetBlock(dockerfile, target) {
  const match = dockerfile.match(
    new RegExp(`FROM [^\\n]+ AS ${target}\\r?\\n([\\s\\S]*?)(?=\\nFROM |$)`, 'i'),
  );
  return match?.[1];
}

export function assertDeploymentConfig({ dockerfile, compose, envTemplate, cors }) {
  const errors = [];

  for (const service of PRIVATE_SERVICES) {
    const block = serviceBlock(compose, service);
    if (!block) errors.push(`Compose service ${service} is required`);
    else if (/^ {4}ports:/m.test(block)) errors.push(`${service} must not publish ports`);
  }

  for (const service of APP_SERVICES) {
    const block = serviceBlock(compose, service);
    if (!block) continue;
    if (/\bDATABASE_URL\s*:/.test(block)) {
      errors.push(`${service} must not receive DATABASE_URL owner credentials`);
    }
    if (!/no-new-privileges:true/.test(block)) {
      errors.push(`${service} must enable no-new-privileges`);
    }
  }

  const migrate = serviceBlock(compose, 'migrate');
  if (!migrate || !/^ {4}profiles:\s*\[tools\]\s*$/m.test(migrate)) {
    errors.push('Owner credentials must stay behind the explicit tools profile');
  }

  if (/\bimage:\s*[^\s]+:latest(?:\s|$)/i.test(compose)) {
    errors.push('Mutable latest image tags are forbidden');
  }

  for (const target of RUNTIME_TARGETS) {
    const block = targetBlock(dockerfile, target);
    if (!block || !/^USER node\s*$/m.test(block) || /^USER root\s*$/m.test(block)) {
      errors.push(`${target} must run as the non-root node user`);
    }
  }

  if (!/^APP_ENV=staging\s*$/m.test(envTemplate)) {
    errors.push('Staging env template must set APP_ENV=staging');
  }
  if (!/^R2_BUCKET_PUBLIC_ACCESS=false\s*$/m.test(envTemplate)) {
    errors.push('R2 bucket public access must be false');
  }

  let corsRules;
  try {
    corsRules = JSON.parse(cors);
  } catch {
    errors.push('R2 CORS must be valid JSON');
  }
  if (Array.isArray(corsRules)) {
    const origins = corsRules.flatMap((rule) => rule.AllowedOrigins ?? []);
    if (origins.includes('*')) errors.push('R2 CORS wildcard origins are forbidden');
    if (origins.length !== 1 || origins[0] !== 'https://REPLACE_WITH_TS_NET_HOST') {
      errors.push('R2 CORS must name only the staging HTTPS origin');
    }
    const methods = [...(corsRules[0]?.AllowedMethods ?? [])].sort();
    if (JSON.stringify(methods) !== JSON.stringify(['GET', 'HEAD', 'PUT'])) {
      errors.push('R2 CORS methods must be GET, HEAD, and PUT only');
    }
    const allowedHeaders = (corsRules[0]?.AllowedHeaders ?? []).map((value) =>
      String(value).toLowerCase(),
    );
    if (allowedHeaders.length !== 1 || allowedHeaders[0] !== 'content-type') {
      errors.push('R2 CORS must allow only the content-type header');
    }
    const exposedHeaders = (corsRules[0]?.ExposeHeaders ?? []).map((value) =>
      String(value).toLowerCase(),
    );
    if (exposedHeaders.length !== 1 || exposedHeaders[0] !== 'etag') {
      errors.push('R2 CORS must expose only the etag header');
    }
  } else if (corsRules !== undefined) {
    errors.push('R2 CORS must be an array of rules');
  }

  if (errors.length > 0) throw new Error(errors.join('; '));
}

export async function readDeploymentFiles(rootDirectory) {
  const repositoryRoot = rootDirectory ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const [dockerfile, compose, envTemplate, cors] = await Promise.all([
    readFile(resolve(repositoryRoot, 'deploy/Dockerfile'), 'utf8'),
    readFile(resolve(repositoryRoot, 'deploy/compose.staging.yaml'), 'utf8'),
    readFile(resolve(repositoryRoot, 'deploy/staging.env.example'), 'utf8'),
    readFile(resolve(repositoryRoot, 'deploy/r2-cors.json'), 'utf8'),
  ]);
  return { dockerfile, compose, envTemplate, cors };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    assertDeploymentConfig(await readDeploymentFiles());
    console.log('Deployment configuration checks passed.');
  } catch (error) {
    console.error(
      `Deployment configuration check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    process.exitCode = 1;
  }
}
