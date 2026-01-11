<script lang="ts">
    import {ChevronLeft, ChevronRight} from "carbon-icons-svelte";
    import { onMount, onDestroy } from "svelte";
    import { fly } from "svelte/transition";
    import { quintOut, cubicOut } from "svelte/easing";
    
    // Custom width transition
    function widthTransition(node, { duration = 300, easing = cubicOut }) {
        const targetWidth = node.scrollWidth;
        
        return {
            duration,
            easing,
            css: t => {
                const width = t * targetWidth;
                return `
                    width: ${width}px;
                    min-width: ${width}px;
                    overflow: hidden;
                `;
            }
        };
    }

    export let project:ProjectRT;
    
    let currentLayer: number = 0;
    let layerCount: number = 0;
    
    const MAX_VISIBLE_LAYERS = 9;
    const MAX_VISIBLE_LAYERS_MOBILE = 8;
    
    // Detect mobile screen size
    let isMobile = false;
    
    // Function to check if screen is mobile
    function checkMobile() {
        if (typeof window !== 'undefined') {
            isMobile = window.innerWidth <= 768;
        }
    }
    
    // Check on mount and resize
    onMount(() => {
        checkMobile();
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', checkMobile);
        }
    });
    
    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', checkMobile);
        }
    });
    
    // Calculate visible layer range and ellipsis state
    $: layerInfo = getLayerInfo(currentLayer, layerCount);
    $: visibleLayers = layerInfo.visibleLayers;
    $: showLeftEllipsis = layerInfo.showLeftEllipsis;
    $: showRightEllipsis = layerInfo.showRightEllipsis;
    $: leftEllipsisTarget = layerInfo.leftEllipsisTarget;
    $: rightEllipsisTarget = layerInfo.rightEllipsisTarget;
    
    function getLayerInfo(current: number, total: number) {
        const maxLayers = isMobile ? MAX_VISIBLE_LAYERS_MOBILE : MAX_VISIBLE_LAYERS;
        
        if (total <= maxLayers) {
            return {
                visibleLayers: Array.from({length: total}, (_, i) => i),
                showLeftEllipsis: false,
                showRightEllipsis: false,
                leftEllipsisTarget: null,
                rightEllipsisTarget: null
            };
        }
        
        // Mobile: disable ellipsis buttons entirely, just show centered window
        if (isMobile) {
            const halfWindow = Math.floor(maxLayers / 2);
            let start = Math.max(0, current - halfWindow);
            let end = Math.min(total - 1, start + maxLayers - 1);
            
            // Adjust start if we're near the end
            if (end - start < maxLayers - 1) {
                start = Math.max(0, end - maxLayers + 1);
            }
            
            const visibleLayers = [];
            for (let i = start; i <= end; i++) {
                visibleLayers.push(i);
            }
            
            return {
                visibleLayers,
                showLeftEllipsis: false,
                showRightEllipsis: false,
                leftEllipsisTarget: null,
                rightEllipsisTarget: null
            };
        }
        
        // Desktop: original logic with ellipsis
        const needsLeftEllipsis = current >= Math.floor(maxLayers / 2) && total > maxLayers;
        const needsRightEllipsis = current < total - Math.ceil(maxLayers / 2) && total > maxLayers;
        
        // Calculate how many layer buttons we can show (reserve space for ellipsis)
        let availableSlots = maxLayers;
        if (needsLeftEllipsis) availableSlots--;
        if (needsRightEllipsis) availableSlots--;
        
        const halfWindow = Math.floor(availableSlots / 2);
        let start = Math.max(0, current - halfWindow);
        let end = Math.min(total - 1, start + availableSlots - 1);
        
        // Adjust start if we're near the end
        if (end - start < availableSlots - 1) {
            start = Math.max(0, end - availableSlots + 1);
        }
        
        // Final check - adjust ellipsis visibility based on actual start/end
        const showLeftEllipsis = start > 0;
        const showRightEllipsis = end < total - 1;
        
        const visibleLayers = [];
        for (let i = start; i <= end; i++) {
            visibleLayers.push(i);
        }
        
        return {
            visibleLayers,
            showLeftEllipsis,
            showRightEllipsis,
            leftEllipsisTarget: showLeftEllipsis ? Math.max(0, start - halfWindow) : null,
            rightEllipsisTarget: showRightEllipsis ? Math.min(total - 1, end + halfWindow) : null
        };
    }
    
    function jumpToLayer(layerIndex: number) {
        selectLayer(layerIndex);
    }

    function selectLayer(index: number) {
        project.LayerChange(index)
    }

    function selectOffsetLayer(offset: -1 | 1): void {
        var newLayer = currentLayer;
        if(offset == -1) {
            if (newLayer - 1 >= 0) {
                newLayer -= 1
            }
        }
        else {
            if (newLayer + 1 < layerCount) {
                newLayer += 1
            }
        }

        project.LayerChange(newLayer)
    }

    var refreshInterval = setInterval(() => {
            currentLayer = project.currentLayer;
        }, 10)

    onMount(() => {
        layerCount = project.projectInfo.layer;
        currentLayer = project.currentLayer;
    })
    
    onDestroy(() => {
        clearInterval(refreshInterval)
    })
</script>

<div class="layer-selector-container">
    <div class="layer-control" on:click={() => selectOffsetLayer(-1)}>
        <ChevronLeft size={24}/>
    </div>

    <div class="layers-container">
        {#if showLeftEllipsis}
            <div class="layer ellipsis" 
                 on:click={() => jumpToLayer(leftEllipsisTarget)}
                 in:widthTransition={{duration: 200, easing: quintOut}}
                 out:widthTransition={{duration: 150, easing: quintOut}}>
                <span>...</span>
            </div>
        {/if}
        
        {#each visibleLayers as layer (layer)}
            <div class="layer" 
                 on:click={() => selectLayer(layer)} 
                 class:selected={currentLayer === layer}
                 in:widthTransition={{duration: 200, easing: quintOut}}
                 out:widthTransition={{duration: 150, easing: quintOut}}>
                <span>{layer + 1}</span>
            </div>
        {/each}
        
        {#if showRightEllipsis}
            <div class="layer ellipsis" 
                 on:click={() => jumpToLayer(rightEllipsisTarget)}
                 in:widthTransition={{duration: 200, easing: quintOut}}
                 out:widthTransition={{duration: 150, easing: quintOut}}>
                <span>...</span>
            </div>
        {/if}
    </div>

    <div class="layer-control" on:click={() => selectOffsetLayer(1)}>
        <ChevronRight size={24} />
    </div>
</div>

<style lang="scss">
    .layer-selector-container {
        width: 100%;
        max-width: 100%;
        
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px;
        // filter: drop-shadow(0px 0px 3px rgba(0, 0, 0, 0.25));

        .layer-control {
            min-width: 36px;
            width: 36px;
            height: 36px;
            display: flex;
            justify-content: center;
            align-items: center;
            border-radius: 50%;
            cursor: pointer;
            flex-shrink: 0;

            transition: background-color 0.2s ease;
            background-color: var(--bg3);
            box-shadow: 0 0 4px rgba(0, 0, 0, 0.15);

            color: var(--text1);

            &:hover {
                background-color: var(--bg1);

                color: var(--text1);
            }

            &:active  {
                background-color: var(--bg1);
                scale: 0.95;
            }
        }

        .layers-container {
            min-width: 0;
            flex: 0 0 auto;
            display: flex;
            justify-content: center;
            gap: 0.5em;
            padding: 8px 0;

            overflow: visible;

            .layer {
                min-width: 30px;
                width: 40px;
                height: 40px;

                background-color: var(--bg3);
                cursor: pointer;
                box-shadow: 0 0 4px rgba(0, 0, 0, 0.15);

                border-radius: 5px;

                display: flex;
                justify-content: center;
                align-items: center;

                flex-shrink: 1;
                
                transition: background-color 0.2s ease, width 0.2s ease;

                span {
                    color: var(--text2);
                    font-family: Inter, sans-serif;
                    font-weight: 500;
                }

                &:hover {
                    background-color: var(--bg1);
                    width: min(50px, 100%);
                }

                &.selected {
                    background-color: var(--selected);
                    width: min(80px, 100%);
                    span {
                        color: var(--text1);
                        font-family: Inter, sans-serif;
                        font-weight: 500;
                    }
                }
                
                &.ellipsis {
                    background-color: var(--bg3);
                    
                    span {
                        color: var(--text2);
                        font-family: Inter, sans-serif;
                        font-weight: 600;
                        letter-spacing: 2px;
                    }
                    
                    &:hover {
                        background-color: var(--bg1);
                        
                        span {
                            color: var(--text1);
                        }
                    }
                }   
            }
        }
        
        // Mobile responsive: thinner buttons and disable width expansion
        @media (max-width: 768px) {
            .layers-container .layer {
                width: 28px;
                min-width: 24px;
                
                &:hover {
                    width: 28px !important;
                }

                &.selected {
                    width: 28px !important;
                }
            }
        }
    }
</style>