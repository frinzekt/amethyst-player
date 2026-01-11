import LaunchpadProMk2 from "./LaunchpadProMk2.svelte";
import LaunchpadMk2 from "./LaunchpadMk2.svelte";
import LaunchpadX from "./LaunchpadX.svelte";
import LaunchpadProMk3 from "./LaunchpadProMk3.svelte";
import Mystrix from "./Mystrix.svelte";


export let virtualDeviceComponents : {[name:string]: any} = {
  "Mystrix": { component: Mystrix },
  "Launchpad Pro MK2": { component: LaunchpadProMk2 },
  "Launchpad MK2": { component: LaunchpadMk2 },
  "Launchpad X": { component: LaunchpadX },
  "Launchpad Pro MK3": { component: LaunchpadProMk3 },
} as const;


