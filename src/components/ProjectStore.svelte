<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import type { PublicProject, SubmittedProject } from '../lib/supabase';
    import Search from "carbon-icons-svelte/lib/Search.svelte";
    import Download from "carbon-icons-svelte/lib/Download.svelte";
    import Close from "carbon-icons-svelte/lib/Close.svelte";
    import Video from "carbon-icons-svelte/lib/Video.svelte";
    import Upload from "carbon-icons-svelte/lib/Upload.svelte";
    import Add from "carbon-icons-svelte/lib/Add.svelte";
    import Play from "carbon-icons-svelte/lib/Play.svelte";
    import Calendar from "carbon-icons-svelte/lib/Calendar.svelte";
    import { t } from '$lib/translations';
    import Dropdown from "./Dropdown.svelte";
    import { supabase } from '../lib/supabase';
    // Note: Play icon and downloadedProjectsService imports removed since caching is disabled

    let ProjectStoreService: any = null;

    export let show: boolean = false;

    const dispatch = createEventDispatcher();
    let projectStore: any = null;

    let projects: PublicProject[] = [];
    let filteredProjects: PublicProject[] = [];
    let searchQuery = '';
    let loading = true;
    let error = '';
    let sortBy = 'downloads'; // 'latest' or 'downloads'
    let downloadingProjects = new Map(); // Track downloading projects with progress
    
    // Submission-related variables
    let activeTab = 'browse'; // 'browse' or 'submit'
    let submissionService: any = null;
    
    // Submission form data
    let submissionForm = {
        name: '',
        author: '',
        description: '',
        email: '',
        videoUrl: '',
        file: null as File | null,
        authorPermission: false
    };
    let submissionLoading = false;
    let submissionError = '';
    let submissionSuccess = false;

    onMount(async () => {
        if (browser) {
            try {
                const { ProjectStoreService: Service } = await import('../lib/services/projectStore');
                const { ProjectSubmissionService } = await import('../lib/services/projectSubmission');
                
                ProjectStoreService = Service;
                projectStore = new ProjectStoreService();
                submissionService = new ProjectSubmissionService();
                
                await loadProjects();
            } catch (err) {
                error = 'Failed to load project store service';
                loading = false;
                console.error('ProjectStore initialization error:', err);
            }
        } else {
            loading = false;
            error = 'Project store is only available in the browser';
        }
    });

    async function loadProjects() {
        if (!projectStore) {
            error = 'Project store service not available';
            loading = false;
            return;
        }

        try {
            loading = true;
            error = '';
            projects = await projectStore.getPublicProjects();
            filteredProjects = projects;
            
            // Debug: Print project metadata
            // console.log('=== PROJECT METADATA DEBUG ===');
            // projects.forEach((project, index) => {
            //     console.log(`Project ${index + 1}:`);
            //     console.log({
            //         id: project.id,
            //         name: project.name,
            //         author: project.author,
            //         description: project.description,
            //         download_count: project.download_count,
            //         play_count: project.play_count,
            //         created_at: project.created_at,
            //         file_url: project.file_url,
            //         video_url: project.video_url
            //     });
            //     console.log('---');
            // });
            // console.log('=== END DEBUG ===');
            
            sortProjects();
        } catch (err) {
            error = err.message || 'Failed to load projects';
            console.error('Error loading projects:', err);
        } finally {
            loading = false;
        }
    }

    async function handleSearch() {
        if (!searchQuery.trim()) {
            filteredProjects = projects;
            sortProjects();
            return;
        }

        if (!projectStore) {
            // Fallback to client-side search
            filteredProjects = projects.filter(p => 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.description.toLowerCase().includes(searchQuery.toLowerCase())
            );
            sortProjects();
            return;
        }

        try {
            filteredProjects = await projectStore.searchProjects(searchQuery);
            sortProjects();
        } catch (err) {
            console.error('Search error:', err);
            // Fallback to client-side search
            filteredProjects = projects.filter(p => 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.description.toLowerCase().includes(searchQuery.toLowerCase())
            );
            sortProjects();
        }
    }

    async function downloadProject(project: PublicProject) {
        if (!projectStore) {
            error = 'Project store service not available';
            return;
        }

        if (downloadingProjects.has(project.id)) {
            return; // Already downloading
        }

        try {
            // Set initial progress
            downloadingProjects.set(project.id, { progress: 0, status: 'starting' });
            downloadingProjects = downloadingProjects; // Trigger reactivity

            const file = await downloadProjectWithProgress(project.id);
            
            // Complete
            downloadingProjects.set(project.id, { progress: 100, status: 'complete' });
            downloadingProjects = downloadingProjects;
            
            // Increment both download and play counters
            try {
                const { error: downloadError } = await supabase.rpc('increment_download_count', {
                    project_uuid: project.id
                });
                
                const { error: playError } = await supabase.rpc('increment_play_count', {
                    project_uuid: project.id
                });
                
                if (downloadError) console.error('Failed to increment download count:', downloadError);
                if (playError) console.error('Failed to increment play count:', playError);
                
                // Update local project data to reflect new counts
                if (!downloadError && !playError) {
                    // Find and update the project in both arrays
                    const updateProjectCounts = (projectArray) => {
                        const projectIndex = projectArray.findIndex(p => p.id === project.id);
                        if (projectIndex !== -1) {
                            projectArray[projectIndex] = {
                                ...projectArray[projectIndex],
                                download_count: (projectArray[projectIndex].download_count || 0) + 1,
                                play_count: (projectArray[projectIndex].play_count || 0) + 1
                            };
                        }
                    };
                    
                    updateProjectCounts(projects);
                    updateProjectCounts(filteredProjects);
                    
                    // Trigger reactivity
                    projects = projects;
                    filteredProjects = filteredProjects;
                }
            } catch (error) {
                console.error('Failed to update counters:', error);
            }
            
            // Note: Caching disabled due to storage limitations
            // await downloadedProjectsService.addDownloadedProject(
            //     project.id, 
            //     project.name, 
            //     project.author, 
            //     file
            // );
            
            dispatch('projectSelected', { file, projectInfo: project });
            
            // Clean up after a short delay
            setTimeout(() => {
                downloadingProjects.delete(project.id);
                downloadingProjects = downloadingProjects;
            }, 1000);
            
            show = false;
        } catch (err) {
            downloadingProjects.delete(project.id);
            downloadingProjects = downloadingProjects;
            error = `Failed to download project: ${err.message}`;
        }
    }

    async function downloadProjectWithProgress(projectId: string): Promise<File> {
        // Import supabase dynamically in browser
        const { supabase } = await import('../lib/supabase');
        
        if (!supabase) {
            throw new Error('Supabase is not configured');
        }

        // Get project data
        const { data, error } = await supabase
            .from('public_projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (error) throw error;
        if (!data) throw new Error('Project not found');

        // Update download count
        try {
            await supabase
                .from('public_projects')
                .update({ download_count: (data.download_count || 0) + 1 })
                .eq('id', projectId);
        } catch (err) {
            console.warn('Could not update download count:', err);
        }

        // Download with progress tracking
        const response = await fetch(data.file_url);
        if (!response.ok) throw new Error('Failed to download file');

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        
        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            chunks.push(value);
            received += value.length;
            
            if (total > 0) {
                const progress = Math.round((received / total) * 100);
                downloadingProjects.set(projectId, { progress, status: 'downloading' });
                downloadingProjects = downloadingProjects; // Trigger reactivity
            }
        }

        // Combine chunks
        const allChunks = new Uint8Array(received);
        let position = 0;
        for (const chunk of chunks) {
            allChunks.set(chunk, position);
            position += chunk.length;
        }

        const blob = new Blob([allChunks]);
        
        // Extract filename from URL or use project name as fallback
        const urlParts = data.file_url.split('/');
        const fileName = urlParts[urlParts.length - 1] || `${data.name}.zip`;
        
        return new File([blob], fileName, { type: blob.type });
    }

    function openVideo(videoUrl: string) {
        window.open(videoUrl, '_blank');
    }

    // Note: playProject function removed since caching is disabled
    // Projects are downloaded fresh each time

    function handleSortChange() {
        sortProjects();
    }

    function sortProjects() {
        if (sortBy === 'downloads') {
            filteredProjects = [...filteredProjects].sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
        } else {
            filteredProjects = [...filteredProjects].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
    }

    function closeStore() {
        show = false;
        dispatch('close');
    }

    function switchTab(tab: string) {
        activeTab = tab;
        submissionError = '';
        submissionSuccess = false;
    }

    function handleFileSelect(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        
        if (file) {
            if (!file.name.toLowerCase().endsWith('.zip')) {
                submissionError = $t('sidebar.file_type_error');
                target.value = '';
                return;
            }
            
            if (file.size > 50 * 1024 * 1024) {
                submissionError = $t('sidebar.file_size_error');
                target.value = '';
                return;
            }
            
            submissionForm.file = file;
            submissionError = '';
        }
    }

    async function submitProject() {
        // Clear any previous errors
        submissionError = '';
        
        if (!submissionService) {
            submissionError = $t('sidebar.submission_service_error');
            return;
        }

        // Detailed field validation
        if (!submissionForm.name.trim()) {
            submissionError = $t('sidebar.project_name') + ': ' + $t('sidebar.field_required');
            return;
        }
        
        if (!submissionForm.author.trim()) {
            submissionError = $t('sidebar.project_author') + ': ' + $t('sidebar.field_required');
            return;
        }
        
        if (!submissionForm.email.trim()) {
            submissionError = $t('sidebar.project_email') + ': ' + $t('sidebar.field_required');
            return;
        }
        
        // Email validation
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(submissionForm.email)) {
            submissionError = $t('sidebar.invalid_email');
            return;
        }
        
        // URL validation (if provided)
        if (submissionForm.videoUrl.trim() && submissionForm.videoUrl.trim() !== '') {
            const urlPattern = /^https?:\/\/.+/;
            if (!urlPattern.test(submissionForm.videoUrl)) {
                submissionError = $t('sidebar.invalid_url');
                return;
            }
        }
        
        if (!submissionForm.file) {
            submissionError = $t('sidebar.project_file_unipack') + ': ' + $t('sidebar.field_required');
            return;
        }
        
        if (!submissionForm.authorPermission) {
            submissionError = $t('sidebar.field_required');
            return;
        }

        try {
            submissionLoading = true;

            const projectData = {
                name: submissionForm.name,
                author: submissionForm.author,
                description: submissionForm.description,
                videoUrl: submissionForm.videoUrl || undefined
            };

            // Submit anonymously - no user authentication required
            await submissionService.submitProject(
                projectData,
                submissionForm.file,
                submissionForm.email
            );

            // Reset form
            submissionForm = {
                name: '',
                author: '',
                description: '',
                email: '',
                videoUrl: '',
                file: null,
                authorPermission: false
            };
            
            // Clear file input
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            
            submissionSuccess = true;
            
        } catch (err) {
            submissionError = err instanceof Error ? err.message : 'Submission failed';
        } finally {
            submissionLoading = false;
        }
    }


    $: if (searchQuery !== undefined) {
        handleSearch();
    }
</script>

{#if show}
    <div class="project-store-overlay" on:click={closeStore}>
        <div class="project-store-modal" on:click|stopPropagation>
            <div class="modal-header">
                <h2>
                    {#if activeTab === 'submit'}
                        {$t('sidebar.submit_project')}
                    {:else}
                        {$t('sidebar.project_store_title')}
                    {/if}
                </h2>
                <div class="header-buttons">
                    {#if activeTab === 'submit'}
                        <button 
                            class="back-button" 
                            on:click={() => switchTab('browse')}
                            title="Back to Browse"
                        >
                            <Search size={16} />
                            <span>{$t('sidebar.browse_projects')}</span>
                        </button>
                    {:else}
                        <button 
                            class="submit-project-button" 
                            on:click={() => switchTab('submit')}
                            title="Submit Project"
                        >
                            <Add size={16} />
                            <span>{$t('sidebar.submit_project')}</span>
                        </button>
                    {/if}
                    <button class="close-button" on:click={closeStore}>
                        <Close size={24} />
                    </button>
                </div>
            </div>

            {#if activeTab === 'browse'}
            <div class="search-section">
                <div class="search-input-container">
                    <Search size={20} />
                    <input 
                        type="text" 
                        placeholder={$t('sidebar.search_projects')}
                        bind:value={searchQuery}
                        class="search-input"
                    />
                </div>
                <div class="sort-container">
                    <button 
                        class="sort-button {sortBy === 'downloads' ? 'active' : ''}" 
                        on:click={() => { sortBy = 'downloads'; handleSortChange(); }}
                    >
                        {$t('sidebar.sort_popular')}
                    </button>
                    <button 
                        class="sort-button {sortBy === 'latest' ? 'active' : ''}" 
                        on:click={() => { sortBy = 'latest'; handleSortChange(); }}
                    >
                        {$t('sidebar.sort_latest')}
                    </button>
                </div>
            </div>

            {#if error}
                <div class="error-message">{error}</div>
            {/if}

            <div class="projects-container">
                {#if loading}
                    <div class="loading-message">Loading projects...</div>
                {:else if filteredProjects.length === 0}
                    <div class="empty-message">No projects found</div>
                {:else}
                    {#each filteredProjects as project}
                        <div class="project-card">
                            <div class="project-info">
                                <h3 class="project-name">{project.name}</h3>
                                <p class="project-author">by {project.author}</p>
                                <p class="project-description">{project.description}</p>
                                <div class="project-meta">
                                    <span class="stat-item">
                                        <Play size={16} />
                                        <span class="stat-count">{project.play_count || 0}</span>
                                    </span>
                                    <span class="stat-item">
                                        <Calendar size={16} />
                                        <span class="stat-count">{new Date(project.created_at).toLocaleDateString('en-CA')}</span>
                                    </span>
                                </div>
                                {#if project.tags && project.tags.length > 0}
                                    <div class="project-tags">
                                        {#each project.tags as tag}
                                            <span class="tag">{tag}</span>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                            <div class="project-actions">
                                {#if project.video_url}
                                    <button class="video-button" on:click={() => openVideo(project.video_url)}>
                                        <Video size={20} />
                                    </button>
                                {/if}
                                
                                {#if downloadingProjects.has(project.id)}
                                    {@const downloadInfo = downloadingProjects.get(project.id)}
                                    <div class="download-progress-button">
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: {downloadInfo.progress}%"></div>
                                            <div class="progress-text">
                                                {#if downloadInfo.status === 'starting'}
                                                    {$t('sidebar.downloading')}
                                                {:else if downloadInfo.status === 'downloading'}
                                                    {downloadInfo.progress}%
                                                {:else if downloadInfo.status === 'complete'}
                                                    {$t('sidebar.complete')}
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                {:else}
                                    <button class="download-button" on:click={() => downloadProject(project)}>
                                        <Download size={20} />
                                        {$t('sidebar.download')}
                                    </button>
                                {/if}
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
            {/if}

            {#if activeTab === 'submit'}
            <div class="submission-section">
                {#if submissionSuccess}
                    <div class="success-container">
                        <div class="success-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="m9 12 2 2 4-4"/>
                            </svg>
                        </div>
                        <h3>{$t('sidebar.project_submitted_success')}</h3>
                        <p class="preserve-newlines">{$t('sidebar.project_submitted_description')}</p>
                        <button class="submit-another-button" on:click={() => { submissionSuccess = false; submissionError = ''; }}>
                            <Add size={16} />
                            {$t('sidebar.submit_another_project')}
                        </button>
                    </div>
                {:else}
                    <div class="submission-form-container">
                        <h3>{$t('sidebar.submit_your_project')}</h3>
                        
                        {#if submissionError}
                            <div class="error-message">{submissionError}</div>
                        {/if}

                        <form class="submission-form" on:submit|preventDefault={submitProject} novalidate>
                            <div class="form-group">
                                <label for="project-file">{$t('sidebar.project_file_unipack')} *</label>
                                <div class="file-input-container">
                                    <input 
                                        id="project-file"
                                        type="file" 
                                        accept=".zip"
                                        on:change={handleFileSelect}
                                        required
                                    />
                                    <div class="file-info" on:click={() => document.getElementById('project-file')?.click()}>
                                        {#if submissionForm.file}
                                            <span class="file-name">{submissionForm.file.name}</span>
                                            <span class="file-size">({(submissionForm.file.size / 1024 / 1024).toFixed(1)} MB)</span>
                                        {:else}
                                            <span class="file-placeholder">{$t('sidebar.choose_zip_file')}</span>
                                        {/if}
                                    </div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="project-name">{$t('sidebar.project_name')} *</label>
                                <input 
                                    id="project-name"
                                    type="text" 
                                    bind:value={submissionForm.name}
                                    placeholder={$t('sidebar.project_name')}
                                    required
                                />
                            </div>

                            <div class="form-group">
                                <label for="project-author">{$t('sidebar.project_author')} *</label>
                                <input 
                                    id="project-author"
                                    type="text" 
                                    bind:value={submissionForm.author}
                                    placeholder={$t('sidebar.project_author')}
                                    required
                                />
                            </div>

                            <div class="form-group">
                                <label for="project-description">{$t('sidebar.project_description')}</label>
                                <textarea 
                                    id="project-description"
                                    bind:value={submissionForm.description}
                                    placeholder={$t('sidebar.project_description_placeholder')}
                                    rows="4"
                                ></textarea>
                            </div>

                            <div class="form-group">
                                <label for="project-video">{$t('sidebar.project_video_url')}</label>
                                <input 
                                    id="project-video"
                                    type="url" 
                                    bind:value={submissionForm.videoUrl}
                                    placeholder={$t('sidebar.project_video_placeholder')}
                                />
                            </div>

                            <div class="form-group">
                                <label for="project-email">{$t('sidebar.project_email')} *</label>
                                <input 
                                    id="project-email"
                                    type="email" 
                                    bind:value={submissionForm.email}
                                    placeholder={$t('sidebar.project_email_placeholder')}
                                    required
                                />
                                <small class="field-hint">{$t('sidebar.project_email_hint')}</small>
                            </div>

                            <div class="form-group checkbox-group">
                                <label class="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        bind:checked={submissionForm.authorPermission}
                                        required
                                    />
                                    <span class="checkbox-text">
                                        {$t('sidebar.author_permission')} *
                                    </span>
                                </label>
                            </div>

                            <button 
                                type="submit" 
                                class="submit-button {submissionError && !submissionLoading ? 'error' : ''}"
                                disabled={submissionLoading || !submissionForm.authorPermission}
                            >
                                {#if submissionLoading}
                                    <div class="loading-container">
                                        <div class="loading-spinner"></div>
                                        <span class="loading-text">{$t('sidebar.submitting')}</span>
                                    </div>
                                {:else if submissionError}
                                    <span class="error-text">{submissionError}</span>
                                {:else}
                                    <Upload size={16} />
                                    {$t('sidebar.submit_project_button')}
                                {/if}
                            </button>
                        </form>
                    </div>
                {/if}
            </div>
            {/if}
        </div>
    </div>
{/if}

<style lang="scss">
    .project-store-overlay {
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

    .project-store-modal {
        background-color: var(--bg1);
        border-radius: 12px;
        width: min(90vw, 800px);
        height: min(85vh, 700px);
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
        }

        .header-buttons {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .close-button {
            background-color: inherit;
            border: 2px solid var(--bg4);
            color: var(--text2);
            cursor: pointer;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            transition: background-color 0.2s, color 0.2s, border-color 0.2s;

            &:hover {
                background-color: var(--bg3);
                border-color: var(--bg4);
                color: var(--text1);
            }
        }

        .submit-project-button, .back-button {
            background-color: inherit;
            border: 2px solid var(--bg4);
            color: var(--text2);
            cursor: pointer;
            height: 36px;
            padding: 0 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            border-radius: 8px;
            transition: background-color 0.2s, color 0.2s, border-color 0.2s;
            font-size: 14px;
            font-family: 'Roboto', sans-serif;
            white-space: nowrap;

            &:hover {
                background-color: var(--bg3);
                border-color: var(--bg4);
                color: var(--text1);
            }

            span {
                font-weight: 500;
            }
        }

        .submit-project-button {
            &.active {
                background-color: #2563EB;
                border-color: #1d4ed8;
                color: white;

                &:hover {
                    background-color: #1d4ed8;
                    border-color: #1e40af;
                }
            }
        }
    }

    .search-section {
        padding: 20px;
        border-bottom: 1px solid var(--bg3);
        display: flex;
        gap: 20px;
        align-items: flex-end;

        .search-input-container {
            flex: 1;
            display: flex;
            align-items: center;
            background-color: var(--bg2);
            border: 2px solid var(--bg3);
            border-radius: 8px;
            padding: 12px;
            gap: 10px;
            color: var(--text2);
            transition: border-color 0.2s;
            height: 48px;
            box-sizing: border-box;

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

        .sort-container {
            display: flex;
            gap: 0;
            width: 200px;
        }

        .sort-button {
            background-color: inherit;
            border: 2px solid var(--bg4);
            color: var(--text2);
            cursor: pointer;
            height: 48px !important;
            min-height: 48px;
            max-height: 48px;
            padding: 0 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-family: 'Roboto', sans-serif;
            font-weight: 400;
            transition: background-color 0.2s, color 0.2s, border-color 0.2s;
            white-space: nowrap;
            box-sizing: border-box;
            flex: 1;

            &:first-child {
                border-radius: 8px 0 0 8px;
                border-right: 1px solid var(--bg4);
            }

            &:last-child {
                border-radius: 0 8px 8px 0;
                border-left: 1px solid var(--bg4);
            }

            &:hover {
                background-color: var(--bg3);
                color: var(--text2);
            }

            &.active {
                background-color: var(--bg3);
                color: var(--text2);
                border-color: var(--bg4);
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

    .loading-message, .empty-message, .error-message {
        text-align: center;
        color: var(--text2);
        padding: 40px;
        font-size: 18px;
    }

    .project-meta {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-top: 8px;

        .stat-item {
            display: flex;
            align-items: center;
            gap: 4px;
            color: var(--text2);
            font-size: 14px;

            .stat-count {
                font-family: 'Roboto', sans-serif;
                font-weight: 500;
            }
        }
    }

    .error-message {
        color: #ff6b6b;
        background-color: rgba(255, 107, 107, 0.1);
        border-radius: 8px;
        margin: 20px;
    }

    .project-card {
        display: flex;
        flex-direction: column;
        background-color: var(--bg2);
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 16px;
        transition: background-color 0.2s;

        @media (min-width: 768px) {
            flex-direction: row;
            justify-content: space-between;
            align-items: flex-start;
        }

        &:hover {
            background-color: var(--bg3);
        }

        .project-info {
            flex: 1;
            
            @media (min-width: 768px) {
                margin-right: 20px;
            }

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

            .project-description {
                color: var(--text1);
                font-size: 16px;
                font-family: 'Roboto', sans-serif;
                font-weight: 300;
                line-height: 1.5;
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
                flex-wrap: nowrap;
                align-items: baseline;
                
                span {
                    white-space: nowrap;
                    flex-shrink: 0;
                    line-height: 1;
                    padding: 0;
                    margin: 0;
                }
            }

            .project-tags {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;

                .tag {
                    background-color: var(--bg4);
                    color: var(--text1);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                }
            }
        }

        .project-actions {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-top: 16px;
            
            @media (min-width: 768px) {
                margin-top: 0;
            }
        }

        .download-button, .video-button, .play-button {
            display: flex;
            align-items: center;
            gap: 8px;
            background-color: var(--bg2);
            border: 2px solid var(--bg4);
            color: var(--text1);
            padding: 12px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-family: "Roboto", sans-serif;
            font-weight: 450;
            transition: all 0.2s;

            &:hover {
                background-color: var(--bg3);
                border-color: var(--bg4);
            }

            &:active {
                scale: 0.98;
            }
        }

        .download-button {
            height: 44px;
            box-sizing: border-box;
            
            @media (max-width: 767px) {
                flex: 1;
                justify-content: center;
                padding: 0 16px;
            }
        }

        .video-button {
            background-color: var(--bg2);
            border-color: var(--bg4);
            font-family: "Roboto", sans-serif;
            width: 44px;
            height: 44px;
            justify-content: center;
            padding: 0;
            flex-shrink: 0;
            box-sizing: border-box;

            @media (max-width: 767px) {
                width: 44px;
                height: 44px;
            }

            &:hover {
                background-color: var(--bg3);
                border-color: var(--bg4);
            }
        }

        .play-button {
            background-color: var(--success-bg, #16A34A);
            border-color: var(--success-border, #15803D);
            color: var(--success-text, white);
            font-family: "Roboto", sans-serif;

            &:hover {
                background-color: var(--success-hover-bg, #15803D);
                border-color: var(--success-hover-border, #166534);
                color: var(--success-hover-text, white);
            }
        }

        .download-progress-button {
            width: 140px; // Same width as download button
            height: 48px; // Same height as download button
            display: flex;
            align-items: center;
            
            @media (max-width: 767px) {
                flex: 1;
            }
            
            .progress-bar {
                width: 100%;
                height: 100%;
                background-color: var(--bg2);
                border: 2px solid var(--bg4);
                border-radius: 8px;
                position: relative;
                overflow: hidden;

                .progress-fill {
                    height: 100%;
                    background: #2563EB;
                    transition: width 0.3s ease;
                    border-radius: 6px;
                }

                .progress-text {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: var(--text1);
                    font-family: "Roboto", sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    z-index: 1;
                    pointer-events: none;
                }
            }
        }
    }


    // Submission Section Styles
    .submission-section {
        flex: 1;
        overflow-y: auto;
        padding: 20px;

        .auth-required {
            text-align: center;
            padding: 60px 20px;
            color: var(--text2);

            p {
                margin: 0 0 8px 0;
                font-size: 16px;
            }

            .auth-hint {
                font-size: 14px;
                opacity: 0.8;
            }
        }

        .submission-form-container, .success-container {
            max-width: 600px;
            margin: 0 auto;

            h3 {
                color: var(--text1);
                margin: 0 0 24px 0;
                font-size: 20px;
                font-weight: 400;
            }

            h4 {
                color: var(--text1);
                margin: 32px 0 16px 0;
                font-size: 18px;
                font-weight: 400;
            }
        }

        .success-container {
            text-align: center;
            padding: 40px 20px;

            .success-icon {
                color: #22c55e;
                margin: 0 auto 24px auto;
                display: flex;
                justify-content: center;
            }

            h3 {
                color: var(--text1);
                font-size: 24px;
                font-weight: 500;
                margin: 0 0 16px 0;
            }

            p {
                color: var(--text2);
                font-size: 16px;
                line-height: 1.5;
                margin: 0 0 32px 0;

                &.preserve-newlines {
                    white-space: pre-line;
                }
            }

            .submit-another-button {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                background-color: #2563EB;
                border: 2px solid #1d4ed8;
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-family: 'Roboto', sans-serif;
                font-weight: 500;
                transition: all 0.2s;
                margin: 0 auto;

                &:hover {
                    background-color: #1d4ed8;
                    border-color: #1e40af;
                }

                &:active {
                    transform: translateY(1px);
                }
            }
        }

        .submission-form {
            .form-group {
                margin-bottom: 20px;

                label {
                    display: block;
                    color: var(--text1);
                    font-size: 14px;
                    font-weight: 500;
                    margin-bottom: 8px;
                }

                input, textarea {
                    width: 100%;
                    background-color: var(--bg2);
                    border: 2px solid var(--bg3);
                    border-radius: 8px;
                    padding: 12px;
                    color: var(--text1);
                    font-size: 14px;
                    font-family: 'Roboto', sans-serif;
                    transition: border-color 0.2s;
                    box-sizing: border-box;

                    &:focus {
                        outline: none;
                        border-color: var(--bg4);
                    }

                    &::placeholder {
                        color: var(--text2);
                    }
                }

                textarea {
                    resize: vertical;
                    min-height: 100px;
                }

                .field-hint {
                    display: block;
                    color: var(--text2);
                    font-size: 12px;
                    margin-top: 4px;
                    font-style: italic;
                }
            }

            .checkbox-group {
                .checkbox-label {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    cursor: pointer;
                    margin-bottom: 0;

                    input[type="checkbox"] {
                        width: auto;
                        margin: 0;
                        margin-top: 2px;
                        flex-shrink: 0;
                    }

                    .checkbox-text {
                        color: var(--text1);
                        font-size: 14px;
                        line-height: 1.4;
                    }
                }
            }

            .file-input-container {
                input[type="file"] {
                    display: none;
                }

                .file-info {
                    background-color: var(--bg2);
                    border: 2px solid var(--bg3);
                    border-radius: 8px;
                    padding: 12px;
                    cursor: pointer;
                    transition: border-color 0.2s;
                    position: relative;

                    &:hover {
                        border-color: var(--bg4);
                    }

                    .file-name {
                        color: var(--text1);
                        font-weight: 500;
                    }

                    .file-size {
                        color: var(--text2);
                        font-size: 12px;
                        margin-left: 8px;
                    }

                    .file-placeholder {
                        color: var(--text2);
                    }
                }
            }


            .submit-button {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                background-color: #2563EB;
                border: 2px solid #1d4ed8;
                color: white;
                padding: 16px 24px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-family: 'Roboto', sans-serif;
                font-weight: 500;
                transition: all 0.2s;
                margin-top: 24px;
                min-height: 56px;

                &:hover:not(:disabled) {
                    background-color: #1d4ed8;
                    border-color: #1e40af;
                }

                &:disabled {
                    background-color: var(--bg3);
                    border-color: var(--bg4);
                    color: var(--text2);
                    cursor: not-allowed;
                    opacity: 1;
                }

                &.error {
                    background-color: #dc2626;
                    border-color: #b91c1c;
                    color: white;
                    cursor: pointer;

                    &:hover:not(:disabled) {
                        background-color: #b91c1c;
                        border-color: #991b1b;
                    }
                }

                .loading-container {
                    display: flex;
                    align-items: center;
                    gap: 12px;

                    .loading-spinner {
                        width: 20px;
                        height: 20px;
                        border: 2px solid rgba(255, 255, 255, 0.3);
                        border-radius: 50%;
                        border-top-color: white;
                        animation: spin 1s ease-in-out infinite;
                    }

                    .loading-text {
                        font-size: 14px;
                        font-weight: 500;
                        white-space: nowrap;
                    }
                }

                .error-text {
                    font-size: 14px;
                    font-weight: 500;
                    text-align: center;
                    line-height: 1.3;
                }
            }

            @keyframes spin {
                0% {
                    transform: rotate(0deg);
                }
                100% {
                    transform: rotate(360deg);
                }
            }
        }

        .success-message {
            background-color: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.3);
            color: #22c55e;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }

        .user-submissions {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid var(--bg3);

            .submission-card {
                background-color: var(--bg2);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;

                .submission-info {
                    flex: 1;

                    h5 {
                        color: var(--text1);
                        margin: 0 0 8px 0;
                        font-size: 16px;
                        font-weight: 500;
                    }

                    p {
                        margin: 0 0 4px 0;
                        font-size: 14px;
                    }

                    .submission-status {
                        font-weight: 500;

                        &.status-pending {
                            color: #f59e0b;
                        }

                        &.status-approved {
                            color: #22c55e;
                        }

                        &.status-rejected {
                            color: #ef4444;
                        }
                    }

                    .submission-date {
                        color: var(--text2);
                    }

                    .admin-notes {
                        color: var(--text2);
                        font-style: italic;
                        margin-top: 8px;
                    }
                }

                .submission-actions {
                    .status-badge {
                        padding: 4px 12px;
                        border-radius: 16px;
                        font-size: 12px;
                        font-weight: 500;
                        text-transform: uppercase;

                        &.status-pending {
                            background-color: rgba(245, 158, 11, 0.1);
                            color: #f59e0b;
                            border: 1px solid rgba(245, 158, 11, 0.3);
                        }

                        &.status-approved {
                            background-color: rgba(34, 197, 94, 0.1);
                            color: #22c55e;
                            border: 1px solid rgba(34, 197, 94, 0.3);
                        }

                        &.status-rejected {
                            background-color: rgba(239, 68, 68, 0.1);
                            color: #ef4444;
                            border: 1px solid rgba(239, 68, 68, 0.3);
                        }
                    }
                }
            }
        }
    }
</style>