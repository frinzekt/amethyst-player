<svelte:options accessors/>
<script lang="ts">
    import type {KeyID, DeviceInfo} from "../../types/devices";
    import type {KeyPress, KeyRelease} from "../../engine/CanvasAPI"
    import { ColorType, Color } from "../../types/color"
    
    import Keypad from "../keypad.svelte";

    let keyPads: any[] = [];
    export let keyPress: KeyPress;
    export let keyRelease: KeyRelease;
    export let id:number;
    export let pos:[number, number];

    export var deviceInfo: DeviceInfo = 
    {
        dimension: [10, 10],
        grid_dimension: [8, 8],
        grid_offset: [1, 1],
        layer_key: [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7],
                    [7, 8], [6, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
                    [-1, 7], [-1, 6], [-1, 5], [-1, 4], [-1, 3], [-1, 2], [-1, 1], [-1, 0]],
    }
    /** Get the clip path for the middle pads. */
    function getCornerRadius (x: number, y: number) {
        switch (x + y * 10) {
            case 43:
                return "polygon(80% 0, 100% 20%, 100% 100%, 0 100%, 0 0)";

            case 44:
                return "polygon(20% 0, 100% 0, 100% 100%, 0 100%, 0 20%)";

            case 33:
                return "polygon(100% 0, 100% 80%, 80% 100%, 0 100%, 0 0)";

            case 34:
                return "polygon(100% 0, 100% 100%, 20% 100%, 0 80%, 0 0)";

            default:
                return "unset";
        }
    }

    
    function getKeypadIndex(keyID: KeyID): number {
        if(Array.isArray(keyID))
        {
            if(keyID[0] === 'c') 
            {keyID = deviceInfo.layer_key[keyID[1]];
            }
            else
            {
                keyID = [
                    keyID[0] + deviceInfo.grid_offset[0],
                    keyID[1] + deviceInfo.grid_offset[1]
                ];
            }
            return keyID[1] * 10 + keyID[0];
        }
        else
        {
            return keyID;
        }
    }

export function setColor(keyID: KeyID, color: Color) {
        let underglow = false;
        if(Array.isArray(keyID))
        {
            if(keyID[0] === 'c') 
            {
                keyID = deviceInfo.layer_key[keyID[1]];
                underglow = true;
            }
            else if(keyID[0] == -1 || keyID[1] == -1 || keyID[0] == deviceInfo.grid_dimension[0] || keyID[1] == deviceInfo.grid_dimension[1]) 
            {
                underglow = true;
            }
        }
        let index = getKeypadIndex(keyID)
        if(keyPads[index]) {
            var screen_color;
            if(underglow) {
                screen_color = color.rgba();
            } else {
                screen_color = color.overlay(new Color(ColorType.RGB, [0x80, 0x80, 0x80]));
            }
            keyPads[index].set_color(screen_color);           
        }
    }
</script>

<div class="lp">
  <div class="lp-underglow">
            <div class="lp-underglow-row">
                {#each Array(8) as _, x}
                    <div class="lp-underglow-led-parent">
                        <Keypad class="lp-underglow-led-btn" deviceID={id} id={[x, -1]} bind:this={keyPads[getKeypadIndex([x, -1])]} keyPress={keyPress} keyRelease={keyRelease}/> 
                    </div>
                {/each}
            </div>
            <div style="display: flex; flex-direction: row; height:88%; justify-content: space-between;">
                <div class="lp-underglow-column">
                    {#each Array(8) as _, y}
                        <div class="lp-underglow-led-parent">
                            <Keypad class="lp-underglow-led-btn" deviceID={id} id={[-1, y]} bind:this={keyPads[getKeypadIndex([-1, y])]}/> 
                        </div>
                    {/each}
                </div>
    
                <div class="lp-underglow-column">
                    {#each Array(8) as _, y}
                    <div class="lp-underglow-led-parent">
                            <Keypad class="lp-underglow-led-btn" deviceID={id} id={[8, y]} bind:this={keyPads[getKeypadIndex([8, y])]}/> 
                    </div>
                    {/each}
                </div>
            </div>
    
            <div class="lp-underglow-row">
                {#each Array(8) as _, x}
                    <div class="lp-underglow-led-parent">
                        <Keypad class="lp-underglow-led-btn" deviceID={id} id={[x, 8]} bind:this={keyPads[getKeypadIndex([x, 8])]}/> 
                    </div>
                {/each}
            </div>
        </div> 
    <div class="lp-border">
        
        <div class="lp-controls">
            {#each Array(8) as _, y}
                <div class="lp-controls-row">
                    {#each Array(8) as _2, x}
                        <div class="lp-btn-parent">
                            {#if (x >= 0 && x < 9) && (y >= 0 && y < 9)}
                            <Keypad class="lp-normal-btn" style="clip-path: {getCornerRadius(x, y)};" deviceID={id} id={[x, y]} bind:this={keyPads[getKeypadIndex([x,y])]} keyPress={keyPress} keyRelease={keyRelease}/> 
                            {/if}
                        </div>
                    {/each}
                </div>
            {/each}
        </div>
    </div>
</div>

<style lang="scss">
    .lp {
        position: relative;

        width: 100%;
        aspect-ratio: 1/1;

        z-index: 1;
    }

    .lp-border {
        background-color: var(--device-body);
        border: 2px solid var(--device-border);
        border-radius: 3%;
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.15);

        position: absolute;

        width: 100%;
        aspect-ratio: 1/1;

        z-index: 2;
    }



    .lp-underglow {
        position: absolute;
        top: -3%;
        left: -3%;
        height: 106%;
        width: 106%;
        // background-color: rgb(20, 20, 20);

        // display: flex;
        // flex-direction: column;
        filter: blur(20px) saturate(200%) brightness(200%);
        z-index: 1;

        .lp-underglow-row {
                height: 6%;
                display: flex;
                padding-left: 6%;
                padding-right: 6%;
                gap:1.5%;

                .lp-underglow-led-parent {
                width: 100%;

                display: flex;
                justify-content: center;
                align-items: center;
            }
        }
        
        .lp-underglow-column {
                height: 100%;
                width: 6%;
                display: flex;
                flex-direction: column;
                gap: 1.5%;
                padding-top: 0.5%;
                padding-bottom: 0.5%;

                .lp-underglow-led-parent {
                height: 20%;
                width: 100%;

                display: flex;
                justify-content: center;
                align-items: center;
            }
        }

        :global(.lp-underglow-led-btn) {
            padding: 0;
            border: none;

            height: 100%;
            width: 100%;
            background-color: rgba(255, 255, 255, 0.0);
        }
    }


    .lp-controls {
        position: relative;
        top: 0;
        left: 0;

        height: 100%;
        width: 100%;

        display: flex;
        gap: 1.5%;
        flex-direction: column;
        padding: 3%;

        z-index: 10;

        .lp-controls-row {
            height: 100%;
            display: flex;
            gap: 1.5%;
        }

        .lp-btn-parent {
            height: 100%;
            width: 100%;

            display: flex;
            justify-content: center;
            align-items: center;

            :global(.lp-normal-btn) {
                padding: 0;
                border: none;

                height: 100%;
                width: 100%;
                border-radius: 10%;
                background-color: var(--device-button);
            }

        }
    }

</style>
