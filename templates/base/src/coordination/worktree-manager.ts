import simpleGit, { SimpleGit } from 'simple-git';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger.js';

export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isLocked: boolean;
}

export class WorktreeManager {
  private git: SimpleGit;
  private worktreeBasePath: string;
  private mainRepoPath: string;
  private worktrees: Map<string, WorktreeInfo> = new Map();

  constructor(mainRepoPath: string = process.cwd(), worktreeBasePath: string = './worktrees') {
    this.mainRepoPath = mainRepoPath;
    this.worktreeBasePath = worktreeBasePath;
    this.git = simpleGit(mainRepoPath);
    
    if (!existsSync(this.worktreeBasePath)) {
      mkdirSync(this.worktreeBasePath, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    logger.info('WorktreeManager', 'Initializing worktree manager');
    
    try {
      // Ensure we're in a git repository
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error('Not in a git repository');
      }

      // List existing worktrees
      await this.refreshWorktreeList();
      
      logger.info('WorktreeManager', `Found ${this.worktrees.size} existing worktrees`);
    } catch (error) {
      logger.error('WorktreeManager', 'Failed to initialize', error);
      throw error;
    }
  }

  async createWorktree(agentId: string, branch?: string): Promise<WorktreeInfo> {
    const worktreePath = join(this.worktreeBasePath, `agent-${agentId}`);
    const branchName = branch || `agent-${agentId}`;
    
    logger.info('WorktreeManager', `Creating worktree for ${agentId}`, { path: worktreePath, branch: branchName });
    
    try {
      // Check if worktree already exists
      if (this.worktrees.has(agentId)) {
        logger.warn('WorktreeManager', `Worktree already exists for ${agentId}`);
        return this.worktrees.get(agentId)!;
      }

      // Create branch if it doesn't exist
      try {
        await this.git.revparse(['--verify', branchName]);
      } catch {
        // Branch doesn't exist, create it
        await this.git.checkoutBranch(branchName, 'main');
        await this.git.checkout('main'); // Switch back to main
      }

      // Create worktree
      await this.git.raw(['worktree', 'add', worktreePath, branchName]);
      
      // Get commit info
      const worktreeGit = simpleGit(worktreePath);
      const log = await worktreeGit.log({ maxCount: 1 });
      const commit = log.latest?.hash || '';

      const info: WorktreeInfo = {
        path: worktreePath,
        branch: branchName,
        commit,
        isLocked: false
      };

      this.worktrees.set(agentId, info);
      
      logger.info('WorktreeManager', `Created worktree for ${agentId}`);
      return info;
    } catch (error) {
      logger.error('WorktreeManager', `Failed to create worktree for ${agentId}`, error);
      
      // Cleanup on failure
      if (existsSync(worktreePath)) {
        rmSync(worktreePath, { recursive: true, force: true });
      }
      
      throw error;
    }
  }

  async removeWorktree(agentId: string): Promise<void> {
    const info = this.worktrees.get(agentId);
    if (!info) {
      logger.warn('WorktreeManager', `No worktree found for ${agentId}`);
      return;
    }

    logger.info('WorktreeManager', `Removing worktree for ${agentId}`);
    
    try {
      // Remove worktree
      await this.git.raw(['worktree', 'remove', info.path, '--force']);
      
      // Remove from map
      this.worktrees.delete(agentId);
      
      logger.info('WorktreeManager', `Removed worktree for ${agentId}`);
    } catch (error) {
      logger.error('WorktreeManager', `Failed to remove worktree for ${agentId}`, error);
      throw error;
    }
  }

  async syncWorktree(agentId: string): Promise<void> {
    const info = this.worktrees.get(agentId);
    if (!info) {
      throw new Error(`No worktree found for ${agentId}`);
    }

    logger.info('WorktreeManager', `Syncing worktree for ${agentId}`);
    
    const worktreeGit = simpleGit(info.path);
    
    try {
      // Stash any uncommitted changes
      await worktreeGit.stash();
      
      // Pull latest changes from main
      await worktreeGit.pull('origin', 'main');
      
      // Update commit info
      const log = await worktreeGit.log({ maxCount: 1 });
      info.commit = log.latest?.hash || '';
      
      logger.info('WorktreeManager', `Synced worktree for ${agentId}`);
    } catch (error) {
      logger.error('WorktreeManager', `Failed to sync worktree for ${agentId}`, error);
      throw error;
    }
  }

  async mergeWorktree(agentId: string, message?: string): Promise<void> {
    const info = this.worktrees.get(agentId);
    if (!info) {
      throw new Error(`No worktree found for ${agentId}`);
    }

    logger.info('WorktreeManager', `Merging worktree for ${agentId}`);
    
    try {
      // Switch to main branch
      await this.git.checkout('main');
      
      // Merge the agent's branch
      const mergeMessage = message || `Merge changes from ${agentId}`;
      await this.git.merge([info.branch, '-m', mergeMessage]);
      
      logger.info('WorktreeManager', `Merged worktree for ${agentId}`);
    } catch (error) {
      logger.error('WorktreeManager', `Failed to merge worktree for ${agentId}`, error);
      
      // Try to abort merge on conflict
      try {
        await this.git.raw(['merge', '--abort']);
      } catch {}
      
      throw error;
    }
  }

  async lockWorktree(agentId: string): Promise<void> {
    const info = this.worktrees.get(agentId);
    if (!info) {
      throw new Error(`No worktree found for ${agentId}`);
    }

    await this.git.raw(['worktree', 'lock', info.path]);
    info.isLocked = true;
    
    logger.info('WorktreeManager', `Locked worktree for ${agentId}`);
  }

  async unlockWorktree(agentId: string): Promise<void> {
    const info = this.worktrees.get(agentId);
    if (!info) {
      throw new Error(`No worktree found for ${agentId}`);
    }

    await this.git.raw(['worktree', 'unlock', info.path]);
    info.isLocked = false;
    
    logger.info('WorktreeManager', `Unlocked worktree for ${agentId}`);
  }

  async commitChanges(agentId: string, message: string): Promise<string> {
    const info = this.worktrees.get(agentId);
    if (!info) {
      throw new Error(`No worktree found for ${agentId}`);
    }

    logger.info('WorktreeManager', `Committing changes for ${agentId}`);
    
    const worktreeGit = simpleGit(info.path);
    
    try {
      // Add all changes
      await worktreeGit.add('.');
      
      // Commit
      const result = await worktreeGit.commit(message);
      info.commit = result.commit;
      
      logger.info('WorktreeManager', `Committed changes for ${agentId}`, { commit: result.commit });
      return result.commit;
    } catch (error) {
      logger.error('WorktreeManager', `Failed to commit changes for ${agentId}`, error);
      throw error;
    }
  }

  async getStatus(agentId: string): Promise<any> {
    const info = this.worktrees.get(agentId);
    if (!info) {
      throw new Error(`No worktree found for ${agentId}`);
    }

    const worktreeGit = simpleGit(info.path);
    return await worktreeGit.status();
  }

  private async refreshWorktreeList(): Promise<void> {
    try {
      const result = await this.git.raw(['worktree', 'list', '--porcelain']);
      const lines = result.split('\n');
      
      this.worktrees.clear();
      
      let currentWorktree: Partial<WorktreeInfo> = {};
      
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          currentWorktree.path = line.substring(9);
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring(7);
        } else if (line.startsWith('HEAD ')) {
          currentWorktree.commit = line.substring(5);
        } else if (line === '') {
          // End of worktree info
          if (currentWorktree.path && currentWorktree.path !== this.mainRepoPath) {
            const agentId = currentWorktree.path!.split('/').pop()!.replace('agent-', '');
            this.worktrees.set(agentId, {
              path: currentWorktree.path!,
              branch: currentWorktree.branch || '',
              commit: currentWorktree.commit || '',
              isLocked: false // Will be updated if needed
            });
          }
          currentWorktree = {};
        }
      }
    } catch (error) {
      logger.error('WorktreeManager', 'Failed to refresh worktree list', error);
    }
  }

  getWorktreeInfo(agentId: string): WorktreeInfo | undefined {
    return this.worktrees.get(agentId);
  }

  getAllWorktrees(): Map<string, WorktreeInfo> {
    return new Map(this.worktrees);
  }
}