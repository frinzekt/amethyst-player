<script>
    import "../shared.css"

    import { createEventDispatcher } from 'svelte';

    let dispatch = createEventDispatcher();
</script>

<button class={$$props.class} style={$$props.style} on:click={() => dispatch("click")}>
    <span>
        <slot/>
    </span>
</button>

<style lang="scss">
    button {
        display: inline-flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;

        padding: 5px 15px;
        border-radius: 8px;

        background-color: var(--bg1);
        border: 2px solid var(--bg4);

        span {
            font-family: "Roboto", sans-serif;

            color: var(--text1);
        }
    }
</style>