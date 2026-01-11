import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'child_process';

const build_time = new Date().toLocaleString("en-US", { 
    timeZone: 'UTC', 
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
}).replace(/(\d+)\/(\d+)\/(\d+),/, '$3/$1/$2');
const git_hash = execSync('git rev-parse --short HEAD').toString().trim();
const commit_count = execSync('git rev-list --count HEAD').toString().trim();
const build_string = `Amethyst Player v${commit_count} Build ${git_hash} (${build_time})`

/** @type {import('vite').UserConfig} */
const config = {
        define: 
	{
		'__BUILD_TIME__':  JSON.stringify(build_time),
                '__BUILD_STRING__':  JSON.stringify(build_string),
	},

        plugins: [sveltekit()]
}

export default config;