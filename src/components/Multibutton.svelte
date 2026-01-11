<script>
    import '../shared.css';

    export let options = [];
    export let value;
</script>

<div class={$$props.class} style={$$props.style}>
    {#each options as option}
        <button on:click={() => value = option} class="{option === value? 'active' : ''}  {option === options[0]? 'left' : option === options[options.length - 1]? 'right' : '' }">{option}</button>
    {/each}
</div>

<style lang="scss">
    div {
        display: inline-block;
        width: fit-content;
    }

    button {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;

        height: 34px;
        padding: 0 10px;

        background-color: var(--bg1);
        border: 1px solid var(--bg4);
        border-top: 2px solid var(--bg4);
        border-bottom: 2px solid var(--bg4);

        font-size: 14px;

        font-family: "Roboto", sans-serif;

        color: var(--text1);

        &.left {
            border-left: 2px solid var(--bg4);
            border-radius: 8px 0 0 8px;
        }

        &.right {
            border-right: 2px solid var(--bg4);
            border-radius: 0 8px 8px 0;
        }

        &.active {
            background-color: var(--bg3);
        }
    }
</style>