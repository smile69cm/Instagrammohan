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

export async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

export async function pushChangesToGitHub(
  owner: string,
  repo: string,
  commitMessage: string,
  files: { path: string; content: string }[]
) {
  const octokit = await getUncachableGitHubClient();

  // Get the default branch
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const branch = repoData.default_branch;

  // Get the current commit
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const currentCommitSha = refData.object.sha;

  // Get the commit tree
  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: currentCommitSha,
  });
  const currentTreeSha = commitData.tree.sha;

  // Create blob objects for each file
  const blobs = await Promise.all(
    files.map(async (file) => {
      const { data } = await octokit.git.createBlob({
        owner,
        repo,
        content: file.content,
        encoding: 'utf-8',
      });
      return { path: file.path, sha: data.sha };
    })
  );

  // Create a new tree
  const { data: newTreeData } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: currentTreeSha,
    tree: blobs.map((blob) => ({
      path: blob.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    })),
  });

  // Create a new commit
  const { data: newCommitData } = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: newTreeData.sha,
    parents: [currentCommitSha],
  });

  // Update the reference
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommitData.sha,
  });

  return newCommitData.sha;
}
