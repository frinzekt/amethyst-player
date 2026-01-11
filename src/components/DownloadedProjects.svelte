<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { downloadedProjectsService, type DownloadedProject } from '../lib/services/downloadedProjects';
    import Close from "carbon-icons-svelte/lib/Close.svelte";
    import Play from "carbon-icons-svelte/lib/Play.svelte";
    import TrashCan from "carbon-icons-svelte/lib/TrashCan.svelte";
    import FolderAdd from "carbon-icons-svelte/lib/FolderAdd.svelte";
    import Search from "carbon-icons-svelte/lib/Search.svelte";
    import { t } from '$lib/translations';

    export let show: boolean = false;

    const dispatch = createEventDispatcher();
    let downloadedProjects: DownloadedProject[] = [];
    let filteredProjects: DownloadedProject[] = [];
    let searchQuery = '';
    let loading = true;
    let error = '';

    onMount(() => {
        if (browser) {
            loadDownloadedProjects();
        }
    });

    function loadDownloadedProjects() {
        try {
            loading = true;
            downloadedProjects = downloadedProjectsService.getDownloadedProjectsSorted();
            filteredProjects = downloadedProjects;
        } catch (err) {
            error = 'Failed to load downloaded projects';
            console.error('Error loading downloaded projects:', err);
        } finally {
            loading = false;
        }
    }

    function handleSearch() {
        if (!searchQuery.trim()) {
            filteredProjects = downloadedProjects;
            return;
        }

        filteredProjects = downloadedProjects.filter(project =>
            project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.author.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }

    async function playProject(project: DownloadedProject) {
        try {
            console.log('Attempting to play project:', project.id, project.name);
            const file = await downloadedProjectsService.getProjectFile(project.id);
            console.log('Retrieved file:', file);
            
            if (file) {
                // Update play statistics
                downloadedProjectsService.updatePlayStats(project.id);
                dispatch('projectSelected', { file, projectInfo: project });
                show = false;
            } else {
                console.log('No file found for project:', project.id);
                error = 'Project file not found. It may have been deleted.';
                // Remove from list
                await downloadedProjectsService.removeDownloadedProject(project.id);
                loadDownloadedProjects();
            }
        } catch (err) {
            console.error('Error playing project:', err);
            error = `Failed to load project: ${err.message}`;
        }
    }

    async function removeProject(project: DownloadedProject) {
        await downloadedProjectsService.removeDownloadedProject(project.id);
        loadDownloadedProjects();
    }

    async function clearAllProjects() {
        if (confirm('Are you sure you want to clear all downloaded projects?')) {
            await downloadedProjectsService.clearAllDownloaded();
            loadDownloadedProjects();
        }
    }

    function importProject() {
        dispatch('importProject');
        show = false;
    }

    function closeModal() {
        show = false;
        dispatch('close');
    }

    // Reload when modal is shown
    $: if (show && browser) {
        loadDownloadedProjects();
    }

    // Handle search reactively
    $: if (searchQuery !== undefined) {
        handleSearch();
    }
</script>

{#if show}
    <div class="downloaded-projects-overlay" on:click={closeModal}>
        <div class="downloaded-projects-modal" on:click|stopPropagation>
            <div class="modal-header">
                <h2>{$t('sidebar.downloaded_projects')}</h2>
                <div class="header-actions">
                    <button class="import-project-button" on:click={importProject}>
                        <FolderAdd size={20} />
                        Import Project
                    </button>
                    {#if downloadedProjects.length > 0}
                        <button class="clear-all-button" on:click={clearAllProjects}>
                            <TrashCan size={20} />
                            Clear All
                        </button>
                    {/if}
                    <button class="close-button" on:click={closeModal}>
                        <Close size={24} />
                    </button>
                </div>
            </div>

            <div class="search-section">
                <div class="search-input-container">
                    <Search size={20} />
                    <input 
                        type="text" 
                        placeholder="Search downloaded projects..." 
                        bind:value={searchQuery}
                        class="search-input"
                    />
                </div>
            </div>

            {#if error}
                <div class="error-message">{error}</div>
            {/if}

            <div class="projects-container">
                {#if loading}
                    <div class="loading-message">Loading projects...</div>
                {:else if filteredProjects.length === 0 && !searchQuery}
                    <div class="empty-message">
                        <p>No downloaded projects yet</p>
                        <p class="empty-subtitle">Projects you download from the store will appear here</p>
                    </div>
                {:else if filteredProjects.length === 0 && searchQuery}
                    <div class="empty-message">
                        <p>No projects found</p>
                        <p class="empty-subtitle">Try a different search term</p>
                    </div>
                {:else}
                    {#each filteredProjects as project}
                        <div class="project-card">
                            <div class="project-info">
                                <h3 class="project-name">{project.name}</h3>
                                <p class="project-author">by {project.author}</p>
                                <div class="project-meta">
                                    {#if project.lastPlayedAt}
                                        <span class="last-played">Last played: {new Date(project.lastPlayedAt).toLocaleDateString()}</span>
                                        <span class="play-count">Played {project.playCount} time{project.playCount !== 1 ? 's' : ''}</span>
                                    {:else}
                                        <span class="never-played">Never played</span>
                                    {/if}
                                </div>
                            </div>
                            <div class="project-actions">
                                <button class="remove-button" on:click={() => removeProject(project)}>
                                    <TrashCan size={20} />
                                </button>
                                <button class="play-button" on:click={() => playProject(project)}>
                                    <Play size={20} />
                                    Play
                                </button>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    </div>
{/if}

<style lang="scss">
    .downloaded-projects-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .downloaded-projects-modal {
        background-color: var(--bg1);
        border-radius: 12px;
        width: min(90vw, 700px);
        height: min(85vh, 600px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--bg3);

        h2 {
            color: var(--text1);
            margin: 0;
            font-size: 24px;
            font-weight: 300;
            font-family: 'Roboto', sans-serif;
        }

        .header-actions {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        .import-project-button {
            display: flex;
            align-items: center;
            gap: 8px;
            background-color: var(--bg2);
            border: 2px solid var(--bg4);
            color: var(--text1);
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-family: "Roboto", sans-serif;
            transition: all 0.2s;

            &:hover {
                background-color: var(--bg3);
                border-color: var(--bg4);
            }
        }

        .clear-all-button {
            display: flex;
            align-items: center;
            gap: 8px;
            background-color: var(--bg2);
            border: 2px solid #ef4444;
            color: #ef4444;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-family: "Roboto", sans-serif;
            transition: all 0.2s;

            &:hover {
                background-color: #ef4444;
                color: white;
            }
        }

        .close-button {
            background-color: var(--bg2);
            border: 2px solid var(--bg4);
            color: var(--text2);
            cursor: pointer;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: background-color 0.2s, color 0.2s, border-color 0.2s;

            &:hover {
                background-color: var(--bg3);
                border-color: var(--bg4);
                color: var(--text1);
            }
        }
    }

    .search-section {
        padding: 20px;
        border-bottom: 1px solid var(--bg3);

        .search-input-container {
            display: flex;
            align-items: center;
            background-color: var(--bg2);
            border: 2px solid var(--bg3);
            border-radius: 8px;
            padding: 12px;
            gap: 10px;
            color: var(--text2);
            transition: border-color 0.2s;

            &:focus-within {
                border-color: var(--bg4);
            }

            .search-input {
                flex: 1;
                background: none;
                border: none;
                color: var(--text1);
                font-size: 16px;
                font-family: 'Roboto', sans-serif;
                outline: none;

                &::placeholder {
                    color: var(--text2);
                }
            }
        }
    }

    .projects-container {
        flex: 1;
        overflow-y: auto;
        padding: 20px;

        // Custom scrollbar styling
        &::-webkit-scrollbar {
            width: 12px;
        }

        &::-webkit-scrollbar-track {
            background: var(--bg2);
            border-radius: 6px;
        }

        &::-webkit-scrollbar-thumb {
            background: var(--bg4);
            border-radius: 6px;
            border: 2px solid var(--bg2);

            &:hover {
                background: var(--text2);
            }
        }

        &::-webkit-scrollbar-thumb:active {
            background: var(--text1);
        }

        // Firefox scrollbar styling
        scrollbar-width: thin;
        scrollbar-color: var(--bg4) var(--bg2);
    }

    .loading-message, .error-message {
        text-align: center;
        color: var(--text2);
        padding: 40px;
        font-size: 18px;
        font-family: 'Roboto', sans-serif;
    }

    .error-message {
        color: #ff6b6b;
        background-color: rgba(255, 107, 107, 0.1);
        border-radius: 8px;
        margin: 20px;
    }

    .empty-message {
        text-align: center;
        padding: 60px 40px;
        color: var(--text2);

        p {
            font-family: 'Roboto', sans-serif;
            font-size: 18px;
            margin: 0 0 10px 0;

            &.empty-subtitle {
                font-size: 14px;
                font-weight: 300;
            }
        }
    }

    .project-card {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        background-color: var(--bg2);
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 16px;
        transition: background-color 0.2s;

        &:hover {
            background-color: var(--bg3);
        }

        .project-info {
            flex: 1;
            margin-right: 20px;

            .project-name {
                color: var(--text1);
                font-size: 20px;
                font-weight: 400;
                font-family: 'Roboto', sans-serif;
                margin: 0 0 8px 0;
            }

            .project-author {
                color: var(--text2);
                font-size: 14px;
                font-family: 'Roboto', sans-serif;
                font-weight: 300;
                margin: 0 0 12px 0;
            }

            .project-meta {
                display: flex;
                gap: 20px;
                font-size: 12px;
                font-family: 'Roboto', sans-serif;
                font-weight: 300;
                color: var(--text2);
                margin-bottom: 0px;
                
                .never-played {
                    color: var(--text2);
                    font-style: italic;
                }
                
                .last-played, .play-count {
                    color: var(--text2);
                }
            }
        }

        .project-actions {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .play-button {
            display: flex;
            align-items: center;
            gap: 8px;
            background-color: var(--success-bg, #16A34A);
            border: 2px solid var(--success-border, #15803D);
            color: var(--success-text, white);
            padding: 12px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-family: "Roboto", sans-serif;
            transition: all 0.2s;

            &:hover {
                background-color: var(--success-hover-bg, #15803D);
                border-color: var(--success-hover-border, #166534);
                color: var(--success-hover-text, white);
            }

            &:active {
                scale: 0.98;
            }
        }

        .remove-button {
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: var(--bg2);
            border: 2px solid #ef4444;
            color: #ef4444;
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;

            &:hover {
                background-color: #ef4444;
                color: white;
            }

            &:active {
                scale: 0.98;
            }
        }
    }
</style>