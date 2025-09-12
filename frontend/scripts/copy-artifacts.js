// frontend/scripts/copy-artifacts.js
const fs = require('fs-extra');
const path = require('path');

async function syncArtifacts() {
    console.log('🔄 Syncing contract artifacts to the frontend...');
    const backendRoot = path.join(__dirname, '../../');
    const artifactsSource = path.join(backendRoot, 'artifacts/contracts');
    const deploymentsSource = path.join(backendRoot, 'deployments.json');
    const frontendContractsDir = path.join(__dirname, '../src/contracts');
    const artifactsDest = path.join(frontendContractsDir, 'artifacts');
    const deploymentsDest = path.join(frontendContractsDir, 'deployments.json');

    try {
        await fs.ensureDir(frontendContractsDir);
        await fs.ensureDir(artifactsDest);
        await fs.copy(artifactsSource, artifactsDest, { overwrite: true });
        console.log('✅ Contract ABIs copied successfully.');
        if (fs.existsSync(deploymentsSource)) {
            await fs.copy(deploymentsSource, deploymentsDest, { overwrite: true });
            console.log('✅ Deployment addresses copied successfully.');
        } else {
            console.warn('⚠️ deployments.json not found in project root. Run the deploy script first.');
        }
        console.log('🎉 Sync complete!');
    } catch (error) {
        console.error('❌ Error syncing artifacts:', error);
    }
}
syncArtifacts();