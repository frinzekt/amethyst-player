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
    export let mobile = false;
    
    
    // Function to help with popup-dependent steps
    function handleStepTransition(stepIndex) {
        const step = steps[stepIndex];
        console.log('Step transition:', stepIndex, step.title, step.highlight);
        
        // Show fake loaded project UI after "Project Store" step
        if (stepIndex === 3) { // After step 2 (Project Store)
            dispatch('showFakeProject');
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
            position: "center"
        },
        {
            title: $t('tutorial.load_project_title'),
            content: $t('tutorial.load_project_content'),
            highlight: ".load-project-button",
            position: "right"
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
            position: "right"
        },
        {
            title: $t('tutorial.demo_controls_title'),
            content: $t('tutorial.demo_controls_content'),
            highlight: ".sidebar-block-demoplay",
            position: "right"
        },
        {
            title: $t('tutorial.demo_settings_title'),
            content: $t('tutorial.demo_settings_content'),
            highlight: ".demoplay-settings-gear",
            position: "right"
        },
        {
            title: $t('tutorial.virtual_device_title'),
            content: $t('tutorial.virtual_device_content'),
            highlight: ".virtual-device-container",
            position: "bottom"
        },
        {
            title: $t('tutorial.layer_navigation_title'),
            content: $t('tutorial.layer_navigation_content'),
            highlight: ".layer-selector-container",
            position: "top"
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
            title: $t('tutorial.keyboard_shortcuts_title'),
            content: $t('tutorial.keyboard_shortcuts_content'),
            highlight: null,
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
            updateHighlighting();
            handleStepTransition(currentStep);
        } else {
            closeTutorial();
        }
    }

    function prevStep() {
        if (currentStep > 0) {
            currentStep--;
            updateHighlighting();
            handleStepTransition(currentStep);
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
        if (!show || !currentStepData.highlight) {
            highlightElement = null;
            tooltipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
            return;
        }

        // Trigger step transition to ensure popups are open
        handleStepTransition(currentStep);

        // Wait for next tick to ensure DOM is updated
        setTimeout(() => {
            const element = document.querySelector(currentStepData.highlight);
            highlightElement = element;
            
            if (!element) {
                tooltipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
                return;
            }

            const rect = element.getBoundingClientRect();
            const position = currentStepData.position;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // For popups, use center positioning to avoid going off-screen
            const isPopup = element.closest('.settings-popup') !== null;
            
            if (isPopup) {
                tooltipStyle = {
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                };
                return;
            }

            // On mobile, use different positioning strategy
            if (mobile) {
                // Mobile: always position at bottom center for better UX
                tooltipStyle = {
                    top: 'auto',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)'
                };
            } else {
                // Desktop positioning logic
                switch (position) {
                    case 'right':
                        const rightPos = rect.right + 20;
                        if (rightPos + 400 > viewportWidth) {
                            tooltipStyle = {
                                top: `${rect.top + rect.height / 2}px`,
                                left: `${rect.left - 20}px`,
                                transform: 'translate(-100%, -50%)'
                            };
                        } else {
                            tooltipStyle = {
                                top: `${rect.top + rect.height / 2}px`,
                                left: `${rightPos}px`,
                                transform: 'translateY(-50%)'
                            };
                        }
                        break;
                    case 'left':
                        const leftPos = rect.left - 20;
                        if (leftPos - 400 < 0) {
                            tooltipStyle = {
                                top: `${rect.top + rect.height / 2}px`,
                                left: `${rect.right + 20}px`,
                                transform: 'translateY(-50%)'
                            };
                        } else {
                            tooltipStyle = {
                                top: `${rect.top + rect.height / 2}px`,
                                left: `${leftPos}px`,
                                transform: 'translate(-100%, -50%)'
                            };
                        }
                        break;
                    case 'bottom':
                        const bottomPos = rect.bottom + 20;
                        if (bottomPos + 200 > viewportHeight) {
                            tooltipStyle = {
                                top: `${rect.top - 20}px`,
                                left: `${rect.left + rect.width / 2}px`,
                                transform: 'translate(-50%, -100%)'
                            };
                        } else {
                            tooltipStyle = {
                                top: `${bottomPos}px`,
                                left: `${rect.left + rect.width / 2}px`,
                                transform: 'translateX(-50%)'
                            };
                        }
                        break;
                    case 'top':
                        const topPos = rect.top - 20;
                        if (topPos - 200 < 0) {
                            tooltipStyle = {
                                top: `${rect.bottom + 20}px`,
                                left: `${rect.left + rect.width / 2}px`,
                                transform: 'translateX(-50%)'
                            };
                        } else {
                            tooltipStyle = {
                                top: `${topPos}px`,
                                left: `${rect.left + rect.width / 2}px`,
                                transform: 'translate(-50%, -100%)'
                            };
                        }
                        break;
                    default:
                        tooltipStyle = {
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)'
                        };
                }
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
        class="tutorial-overlay theme-{$theme}" 
        bind:this={tutorialOverlay}
        transition:fade={{ duration: 300 }}
    >
        <!-- Simple highlight border -->
        {#if highlightElement}
            {@const rect = highlightElement.getBoundingClientRect()}
            <div 
                class="highlight-border"
                style="
                    top: {rect.top - 10}px;
                    left: {rect.left - 10}px;
                    width: {rect.width + 20}px;
                    height: {rect.height + 20}px;
                "
            ></div>
        {/if}

        <!-- Tutorial tooltip -->
        <div 
            class="tutorial-tooltip theme-{$theme}"
            style="
                top: {tooltipStyle.top};
                left: {tooltipStyle.left};
                transform: {tooltipStyle.transform};
            "
            transition:fly={{ y: 20, duration: 300 }}
        >
            <div class="tutorial-header">
                <div class="tutorial-title">
                    <Information size={20} />
                    <span>{currentStepData.title}</span>
                </div>
                <button class="close-button" on:click={closeTutorial}>
                    <Close size={16} />
                </button>
            </div>

            <div class="tutorial-content">
                <p>{@html currentStepData.content.replace(/\n/g, '<br>')}</p>
            </div>

            <div class="tutorial-controls">
                <div class="step-indicator">
                    {currentStep + 1} of {steps.length}
                </div>

                <div class="control-buttons">
                    {#if currentStep === 0}
                        <button class="skip-button" on:click={skipTutorial}>
                            {$t('tutorial.skip_tutorial')}
                        </button>
                    {:else}
                        <button class="prev-button" on:click={prevStep}>
                            <ArrowLeft size={16} />
                            {$t('tutorial.back')}
                        </button>
                    {/if}

                    <button class="next-button" on:click={nextStep}>
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
    .tutorial-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: transparent;
        z-index: 10000;
        pointer-events: auto;
    }

    .highlight-border {
        position: absolute;
        background-color: transparent;
        border: 3px solid #00d4ff;
        border-radius: 8px;
        box-shadow: 
            0 0 20px #00d4ff,
            inset 0 0 20px rgba(0, 212, 255, 0.2);
        pointer-events: none;
        z-index: 10002;
        animation: highlight-pulse 2s ease-in-out infinite alternate;
    }

    @keyframes highlight-pulse {
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

    .tutorial-tooltip {
        position: absolute;
        background-color: #1e1e1e;
        border: 1px solid #333;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        max-width: 400px;
        min-width: 300px;
        z-index: 10002;
        font-family: "Roboto", sans-serif;

        // Light theme
        &.theme-light {
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        }

        // Mobile styles
        @media (max-width: 800px) {
            position: fixed;
            max-width: calc(100vw - 20px);
            min-width: calc(100vw - 20px);
            margin: 0 10px;
            border-radius: 8px;
        }
    }

    .tutorial-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px 12px;
        border-bottom: 1px solid #333;

        .theme-light & {
            border-bottom: 1px solid #e0e0e0;
        }
    }

    .tutorial-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #00d4ff;
        font-weight: 500;
        font-size: 16px;

        .theme-light & {
            color: #0088cc;
        }
    }

    .close-button {
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

    .tutorial-content {
        padding: 16px 20px;
        color: #e0e0e0;
        line-height: 1.6;

        .theme-light & {
            color: #333;
        }

        p {
            margin: 0;
            font-size: 14px;
        }
    }

    .tutorial-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px 16px;
        border-top: 1px solid #333;

        .theme-light & {
            border-top: 1px solid #e0e0e0;
        }
    }

    .step-indicator {
        color: #999;
        font-size: 12px;

        .theme-light & {
            color: #666;
        }
    }

    .control-buttons {
        display: flex;
        gap: 8px;
    }

    .skip-button, .prev-button, .next-button {
        background: none;
        border: 1px solid #555;
        color: #e0e0e0;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-family: "Roboto", sans-serif;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
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

    .next-button {
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

    .skip-button {
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