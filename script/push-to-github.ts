import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function uploadFile(octokit: Octokit, owner: string, repo: string, filePath: string, content: string, sha?: string) {
  try {
    const result = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Update ${filePath}`,
      content: Buffer.from(content).toString('base64'),
      sha: sha,
    });
    console.log(`Uploaded: ${filePath}`);
    return result;
  } catch (error: any) {
    console.error(`Error uploading ${filePath}:`, error.message);
    throw error;
  }
}

async function getFileSha(octokit: Octokit, owner: string, repo: string, filePath: string): Promise<string | undefined> {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
    });
    return (data as any).sha;
  } catch (error) {
    return undefined;
  }
}

async function pushChangesToGitHub() {
  console.log('Connecting to GitHub...');
  const octokit = await getGitHubClient();
  
  const owner = 'smile69cm';
  const repo = 'Instagrammohan';
  
  const filesToUpload = [
    'shared/schema.ts',
    'server/storage.ts',
    'server/routes.ts',
    'server/lib/instagram.ts',
    'server/lib/openai.ts',
    'server/lib/clerk.ts',
    'server/index.ts',
    'client/src/pages/Automations.tsx',
    'client/src/pages/Dashboard.tsx',
    'client/src/pages/Settings.tsx',
    'client/src/pages/Content.tsx',
    'client/src/pages/Auth.tsx',
    'client/src/pages/SignUp.tsx',
    'client/src/components/layout/DashboardLayout.tsx',
    'client/src/App.tsx',
    'client/src/lib/api.ts',
    'client/src/lib/config.ts',
    'package.json',
  ];

  console.log(`Pushing ${filesToUpload.length} files to ${owner}/${repo}...`);
  
  for (const filePath of filesToUpload) {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const sha = await getFileSha(octokit, owner, repo, filePath);
      await uploadFile(octokit, owner, repo, filePath, content, sha);
    } else {
      console.log(`File not found: ${filePath}`);
    }
  }

  console.log('All files pushed successfully!');
}

pushChangesToGitHub().catch(console.error);
