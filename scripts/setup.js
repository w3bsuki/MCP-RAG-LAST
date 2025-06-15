import { mkdirSync, existsSync } from 'fs';
import { logger } from '../src/utils/logger.js';
import simpleGit from 'simple-git';
async function setup() {
    logger.info('Setup', 'Starting system setup...');
    try {
        // Ensure all directories exist
        const directories = [
            'logs',
            'worktrees',
            'rag-store/vectors',
            'rag-store/indexes',
            'rag-store/cache',
            'agents/auditor',
            'agents/implementer',
            'agents/validator'
        ];
        for (const dir of directories) {
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
                logger.info('Setup', `Created directory: ${dir}`);
            }
        }
        // Initialize git if not already initialized
        const git = simpleGit();
        const isRepo = await git.checkIsRepo();
        if (!isRepo) {
            await git.init();
            logger.info('Setup', 'Initialized git repository');
        }
        // Check if main branch exists
        try {
            await git.revparse(['--verify', 'main']);
        }
        catch {
            // Create initial commit
            await git.add('.gitignore');
            await git.commit('Initial commit');
            logger.info('Setup', 'Created initial commit');
        }
        logger.info('Setup', 'Setup completed successfully!');
        logger.info('Setup', 'You can now run: npm start');
    }
    catch (error) {
        logger.error('Setup', 'Setup failed', error);
        process.exit(1);
    }
}
// Run setup
setup().catch(console.error);
//# sourceMappingURL=setup.js.map