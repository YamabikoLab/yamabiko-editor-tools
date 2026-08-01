import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = path.join(appDirectory, 'package.json');
const packageLockPath = path.join(appDirectory, 'package-lock.json');
const pluginPath = path.join(appDirectory, 'yamabiko-editor-tools.php');
const blocksDirectory = path.join(appDirectory, 'src', 'blocks');
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

async function findBlockMetadata(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			files.push(...(await findBlockMetadata(entryPath)));
		} else if (entry.name === 'block.json') {
			files.push(entryPath);
		}
	}

	return files;
}

async function readVersions() {
	const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
	const packageLock = JSON.parse(await readFile(packageLockPath, 'utf8'));
	const pluginContents = await readFile(pluginPath, 'utf8');
	const pluginMatch = pluginContents.match(/^ \* Version: (.+)$/m);

	if (!pluginMatch) {
		throw new Error('Plugin version header was not found.');
	}

	const versions = new Map([
		['package.json', packageJson.version],
		['package-lock.json', packageLock.version],
		['package-lock.json packages root', packageLock.packages?.['']?.version],
		['yamabiko-editor-tools.php', pluginMatch[1]],
	]);

	for (const metadataPath of await findBlockMetadata(blocksDirectory)) {
		const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
		versions.set(path.relative(appDirectory, metadataPath), metadata.version);
	}

	return versions;
}

async function checkVersions() {
	const versions = await readVersions();
	const expectedVersion = versions.get('package.json');
	const mismatches = [...versions].filter(([, version]) => version !== expectedVersion);

	if (mismatches.length > 0) {
		for (const [file, version] of mismatches) {
			console.error(`${file}: expected ${expectedVersion}, found ${version}`);
		}

		process.exitCode = 1;
		return;
	}

	console.log(`All release versions match ${expectedVersion}.`);
}

async function setVersion(version) {
	if (!versionPattern.test(version)) {
		throw new Error(`Invalid version: ${version}`);
	}

	const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
	packageJson.version = version;
	await writeFile(packagePath, `${JSON.stringify(packageJson, null, '\t')}\n`);

	const packageLock = JSON.parse(await readFile(packageLockPath, 'utf8'));
	packageLock.version = version;
	packageLock.packages[''].version = version;
	await writeFile(packageLockPath, `${JSON.stringify(packageLock, null, '\t')}\n`);

	const pluginContents = await readFile(pluginPath, 'utf8');
	await writeFile(
		pluginPath,
		pluginContents.replace(/^ \* Version: .+$/m, ` * Version: ${version}`),
	);

	for (const metadataPath of await findBlockMetadata(blocksDirectory)) {
		const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
		metadata.version = version;
		await writeFile(metadataPath, `${JSON.stringify(metadata, null, '\t')}\n`);
	}

	console.log(`Updated release versions to ${version}.`);
}

const [command, version] = process.argv.slice(2);

if (command === 'check') {
	await checkVersions();
} else if (command === 'set' && version) {
	await setVersion(version);
} else {
	console.error('Usage: node scripts/version.mjs check|set <version>');
	process.exitCode = 1;
}
