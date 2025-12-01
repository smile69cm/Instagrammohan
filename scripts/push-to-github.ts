import { getUncachableGitHubClient } from '../server/lib/github';
import * as fs from 'fs';
import * as path from 'path';

async function getAllFiles(dir: string, baseDir: string = dir): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  const ignoreDirs = ['node_modules', '.git', 'dist', '.cache', '.upm', 'scripts'];
  const ignoreFiles = ['.replit', 'replit.nix', 'package-lock.json'];
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (entry.isDirectory()) {
      if (!ignoreDirs.includes(entry.name) && !entry.name.startsWith('.')) {
        files.push(...await getAllFiles(fullPath, baseDir));
      }
    } else {
      if (!ignoreFiles.includes(entry.name) && !entry.name.endsWith('.log')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          files.push({ path: relativePath, content });
        } catch (e) {
          console.log(`Skipping binary file: ${relativePath}`);
        }
      }
    }
  }
  
  return files;
}

async function main() {
  try {
    const octokit = await getUncachableGitHubClient();
    
    console.log('Fetching GitHub user info...');
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`Logged in as: ${user.login}`);
    
    console.log('\nFetching repositories...');
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 20
    });
    
    console.log('\nRecent repositories:');
    repos.forEach((repo, index) => {
      console.log(`${index + 1}. ${repo.full_name} - ${repo.description || 'No description'}`);
    });
    
    const repoName = process.argv[2];
    if (!repoName) {
      console.log('\nUsage: npx tsx scripts/push-to-github.ts <owner/repo>');
      console.log('Example: npx tsx scripts/push-to-github.ts username/my-repo');
      return;
    }
    
    const [owner, repo] = repoName.split('/');
    console.log(`\nPushing to ${owner}/${repo}...`);
    
    const { data: repoInfo } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoInfo.default_branch;
    console.log(`Default branch: ${defaultBranch}`);
    
    let currentCommitSha: string;
    let treeSha: string;
    
    try {
      const { data: ref } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`
      });
      currentCommitSha = ref.object.sha;
      
      const { data: commit } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: currentCommitSha
      });
      treeSha = commit.tree.sha;
    } catch (e) {
      console.log('Repository is empty, creating initial commit...');
      currentCommitSha = '';
      treeSha = '';
    }
    
    console.log('\nCollecting files...');
    const files = await getAllFiles('.');
    console.log(`Found ${files.length} files to push`);
    
    console.log('\nCreating blobs...');
    const treeItems: { path: string; mode: '100644'; type: 'blob'; sha: string }[] = [];
    
    for (const file of files) {
      try {
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64'
        });
        treeItems.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: blob.sha
        });
        console.log(`  Created blob for: ${file.path}`);
      } catch (e: any) {
        console.log(`  Failed to create blob for ${file.path}: ${e.message}`);
      }
    }
    
    console.log('\nCreating tree...');
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo,
      tree: treeItems,
      base_tree: treeSha || undefined
    });
    
    console.log('Creating commit...');
    const commitMessage = 'Feature: Add following list support for scheduled message username resolution';
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: newTree.sha,
      parents: currentCommitSha ? [currentCommitSha] : []
    });
    
    console.log('Updating branch reference...');
    if (currentCommitSha) {
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`,
        sha: newCommit.sha
      });
    } else {
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${defaultBranch}`,
        sha: newCommit.sha
      });
    }
    
    console.log(`\nSuccess! All files pushed to ${owner}/${repo}`);
    console.log(`Commit: ${newCommit.sha}`);
    console.log(`Message: ${commitMessage}`);
    console.log('\nRender should now be able to build successfully.');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

main();
