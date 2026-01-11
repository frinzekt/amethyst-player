<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import ArrowRight from "carbon-icons-svelte/lib/ArrowRight.svelte";
    import ArrowLeft from "carbon-icons-svelte/lib/ArrowLeft.svelte";
    import Close from "carbon-icons-svelte/lib/Close.svelte";
    import Information from "carbon-icons-svelte/lib/Information.svelte";
    import { t } from '$lib/translations';
    import { theme } from '$lib/stores/theme';

    const dispatch = createEventDispatcher();

    export let show = false;
    export let currentStep = 0;
    
    
    // Function to help with popup-dependent steps
    function handleStepTransition(stepIndex) {
        const step = steps[stepIndex];
        console.log('Mobile step transition:', stepIndex, step.title, step.highlight);
        
        // Show fake loaded project UI after "Load Your First Project" step
        if (stepIndex === 3) { // After step 1 (Load Your First Project)
            dispatch('showFakeProject');
        }
        
        // Hide sidebar for Virtual Device Display step (step index 6)
        if (stepIndex === 7) {
            dispatch('hideSidebar');
        }
        
        // Show sidebar back after Return to Sidebar step (step index 8)
        if (stepIndex === 9) {
            dispatch('showSidebar');
        }
        
        // Handle reverse navigation based on step indices
        const virtualDeviceStepIndex = 6; // "Virtual Device Display" step
        const returnToSidebarStepIndex = 8; // "Return to Sidebar" step
        
        // If going back from Return to Sidebar to Layer Navigation, hide sidebar again
        if (stepIndex === 8 && stepIndex === virtualDeviceStepIndex + 1) { // Layer Navigation step is index 7
            dispatch('hideSidebar');
        }
        
        // If going back from Virtual Device Display to Toggle Sidebar, show sidebar
        if (stepIndex === 6 && stepIndex === virtualDeviceStepIndex - 1) { // Toggle Sidebar step is index 5
            dispatch('showSidebar');
        }
        
        // For steps that require popups to be open, dispatch events to parent
        if (step.highlight === '[data-tutorial="settings"]') {
            console.log('Opening settings popup');
            dispatch('openSettings');
        } else if (step.highlight === '[data-tutorial="devices"]') {
            console.log('Opening devices popup');
            dispatch('openDevices');
        } else if (step.highlight === '[data-tutorial="demoplay"]') {
            console.log('Opening demoplay popup');
            dispatch('openDemoplay');
        }
    }

    $: steps = [
        {
            title: $t('tutorial.welcome_title'),
            content: $t('tutorial.welcome_content'),
            highlight: null,
            position: "bottom"
        },
        {
            title: $t('tutorial.load_project_title'),
            content: $t('tutorial.load_project_content_mobile'),
            highlight: ".load-project-button",
            position: "bottom"
        },
        {
            title: $t('tutorial.project_store_title'),
            content: $t('tutorial.project_store_content'),
            highlight: ".project-store-button",
            position: "right"
        },
        {
            title: $t('tutorial.project_info_title'),
            content: $t('tutorial.project_info_content'),
            highlight: ".sidebar-block-project-info",
            position: "bottom"
        },
        {
            title: $t('tutorial.demo_controls_title'),
            content: $t('tutorial.demo_controls_content'),
            highlight: ".sidebar-block-demoplay",
            position: "bottom"
        },
        {
            title: $t('tutorial.demo_settings_title'),
            content: $t('tutorial.demo_settings_content_mobile'),
            highlight: ".demoplay-settings-gear",
            position: "bottom"
        },
        {
            title: $t('tutorial.toggle_sidebar_title'),
            content: $t('tutorial.toggle_sidebar_content'),
            highlight: ".show-controls-icon-parent",
            position: "bottom"
        },
        {
            title: $t('tutorial.virtual_device_title'),
            content: $t('tutorial.virtual_device_content_mobile'),
            highlight: ".virtual-device-container",
            position: "bottom"
        },
        {
            title: $t('tutorial.layer_navigation_title'),
            content: $t('tutorial.layer_navigation_content_mobile'),
            highlight: ".layer-selector-container",
            position: "center"
        },
        {
            title: $t('tutorial.return_sidebar_title'),
            content: $t('tutorial.return_sidebar_content'),
            highlight: ".show-controls-icon-parent",
            position: "bottom"
        },
        {
            title: $t('tutorial.settings_title'),
            content: $t('tutorial.settings_content'),
            highlight: "[data-tutorial='settings']",
            position: "center"
        },
        {
            title: $t('tutorial.devices_title'),
            content: $t('tutorial.devices_content'),
            highlight: "[data-tutorial='devices']",
            position: "center"
        },
        {
            title: $t('tutorial.ready_title'),
            content: $t('tutorial.ready_content'),
            highlight: null,
            position: "center"
        }
    ];

    let tutorialOverlay: HTMLElement;

    function nextStep() {
        if (currentStep < steps.length - 1) {
            currentStep++;
            handleStepTransition(currentStep);
            updateHighlighting();
        } else {
            closeTutorial();
        }
    }

    function prevStep() {
        if (currentStep > 0) {
            currentStep--;
            handleStepTransition(currentStep);
            updateHighlighting();
        }
    }

    function closeTutorial() {
        show = false;
        dispatch('close');
    }

    function skipTutorial() {
        closeTutorial();
    }

    $: currentStepData = steps[currentStep];

    let highlightElement = null;
    let tooltipStyle = {};

    function updateHighlighting() {
        // Wait for next tick to ensure DOM is updated
        setTimeout(() => {
            const element = currentStepData.highlight ? document.querySelector(currentStepData.highlight) : null;
            highlightElement = element;
            
            // Determine tooltip position based on step
            const stepPosition = currentStepData.position;
            
            // For popup elements, use center positioning
            if (element && element.closest('.settings-popup')) {
                tooltipStyle = {
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                };
                return;
            }

            // For center position steps, put tooltip at center
            if (stepPosition === "center") {
                tooltipStyle = {
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                };
            } else {
                // Default: bottom positioning for mobile
                tooltipStyle = {
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)'
                };
            }
        }, 100);
    }

    $: if (show) {
        updateHighlighting();
    }
    
    $: if (currentStep !== undefined) {
        updateHighlighting();
    }

    // Block keyboard events during tutorial
    function handleKeydown(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    $: if (typeof document !== 'undefined') {
        if (show) {
            document.addEventListener('keydown', handleKeydown, true);
        } else {
            document.removeEventListener('keydown', handleKeydown, true);
        }
    }
</script>

{#if show}
    <div 
        class="tutorial-overlay-mobile theme-{$theme}" 
        bind:this={tutorialOverlay}
        transition:fade={{ duration: 300 }}
    >
        <!-- Simple highlight border -->
        {#if highlightElement}
            {@const rect = highlightElement.getBoundingClientRect()}
            <div 
                class="highlight-border-mobile"
                style="
                    top: {rect.top - 10}px;
                    left: {rect.left - 10}px;
                    width: {rect.width + 20}px;
                    height: {rect.height + 20}px;
                "
            ></div>
        {/if}

        <!-- Mobile tutorial tooltip -->
        <div 
            class="tutorial-tooltip-mobile theme-{$theme}"
            style="
                {tooltipStyle.top ? `top: ${tooltipStyle.top};` : ''}
                {tooltipStyle.bottom ? `bottom: ${tooltipStyle.bottom};` : ''}
                left: {tooltipStyle.left || '50%'};
                transform: {tooltipStyle.transform || 'translateX(-50%)'};
            "
            transition:fly={{ y: 20, duration: 300 }}
        >
            <div class="tutorial-header-mobile">
                <div class="tutorial-title-mobile">
                    <Information size={18} />
                    <span>{currentStepData.title}</span>
                </div>
                <button class="close-button-mobile" on:click={closeTutorial}>
                    <Close size={16} />
                </button>
            </div>

            <div class="tutorial-content-mobile">
                <p>{@html currentStepData.content.replace(/\n/g, '<br>')}</p>
            </div>

            <div class="tutorial-controls-mobile">
                <div class="step-indicator-mobile">
                    {currentStep + 1} of {steps.length}
                </div>

                <div class="control-buttons-mobile">
                    {#if currentStep === 0}
                        <button class="skip-button-mobile" on:click={skipTutorial}>
                            {$t('tutorial.skip_tutorial')}
                        </button>
                    {:else}
                        <button class="prev-button-mobile" on:click={prevStep}>
                            <ArrowLeft size={16} />
                            {$t('tutorial.back')}
                        </button>
                    {/if}

                    <button class="next-button-mobile" on:click={nextStep}>
                        {currentStep === steps.length - 1 ? $t('tutorial.finish') : $t('tutorial.next')}
                        {#if currentStep < steps.length - 1}
                            <ArrowRight size={16} />
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style lang="scss">
    .tutorial-overlay-mobile {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: transparent;
        z-index: 10000;
        pointer-events: auto;
    }

    .highlight-border-mobile {
        position: absolute;
        background-color: transparent;
        border: 3px solid #00d4ff;
        border-radius: 8px;
        box-shadow: 
            0 0 20px #00d4ff,
            inset 0 0 20px rgba(0, 212, 255, 0.2);
        pointer-events: none;
        z-index: 10002;
        animation: highlight-pulse-mobile 2s ease-in-out infinite alternate;
    }

    @keyframes highlight-pulse-mobile {
        0% {
            border-color: #00d4ff;
            box-shadow: 
                0 0 20px #00d4ff,
                inset 0 0 20px rgba(0, 212, 255, 0.2);
        }
        100% {
            border-color: #00c0e6;
            box-shadow: 
                0 0 30px #00d4ff,
                inset 0 0 30px rgba(0, 212, 255, 0.3);
        }
    }

    .tutorial-tooltip-mobile {
        position: fixed;
        background-color: #1e1e1e;
        border: 1px solid #333;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        max-width: calc(100vw - 20px);
        min-width: calc(100vw - 20px);
        margin: 0 10px;
        z-index: 10002;
        font-family: "Roboto", sans-serif;

        &.theme-light {
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        }
    }

    .tutorial-header-mobile {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px 10px;
        border-bottom: 1px solid #333;

        .theme-light & {
            border-bottom: 1px solid #e0e0e0;
        }
    }

    .tutorial-title-mobile {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #00d4ff;
        font-weight: 500;
        font-size: 14px;

        .theme-light & {
            color: #0088cc;
        }
    }

    .close-button-mobile {
        background: none;
        border: none;
        color: #999;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s;

        &:hover {
            color: #fff;
            background-color: #333;
        }

        .theme-light & {
            color: #666;

            &:hover {
                color: #000;
                background-color: #f0f0f0;
            }
        }
    }

    .tutorial-content-mobile {
        padding: 14px 16px;
        color: #e0e0e0;
        line-height: 1.5;

        .theme-light & {
            color: #333;
        }

        p {
            margin: 0;
            font-size: 13px;
        }
    }

    .tutorial-controls-mobile {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px 14px;
        border-top: 1px solid #333;

        .theme-light & {
            border-top: 1px solid #e0e0e0;
        }
    }

    .step-indicator-mobile {
        color: #999;
        font-size: 11px;

        .theme-light & {
            color: #666;
        }
    }

    .control-buttons-mobile {
        display: flex;
        gap: 6px;
    }

    .skip-button-mobile, .prev-button-mobile, .next-button-mobile {
        background: none;
        border: 1px solid #555;
        color: #e0e0e0;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-family: "Roboto", sans-serif;
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 3px;
        transition: all 0.2s;

        &:hover {
            border-color: #777;
            background-color: #2a2a2a;
        }

        .theme-light & {
            border: 1px solid #ccc;
            color: #333;

            &:hover {
                border-color: #999;
                background-color: #f5f5f5;
            }
        }
    }

    .next-button-mobile {
        background-color: #00d4ff;
        border-color: #00d4ff;
        color: #000;

        &:hover {
            background-color: #00c0e6;
            border-color: #00c0e6;
        }

        .theme-light & {
            background-color: #0088cc;
            border-color: #0088cc;
            color: #fff;

            &:hover {
                background-color: #0066aa;
                border-color: #0066aa;
            }
        }
    }

    .skip-button-mobile {
        color: #999;
        border-color: #444;

        &:hover {
            color: #ccc;
        }

        .theme-light & {
            color: #666;
            border-color: #bbb;

            &:hover {
                color: #333;
            }
        }
    }
</style>