<!-- Index file for the player route -->
<script lang="ts">
    import type {KeyID} from "src/types/devices";
    import {Color, ColorType} from "../types/color";

    import {virtualDeviceComponents} from "../components/devices/Devices";

    import type {Canvas, KeyPress, KeyRelease} from "../engine/CanvasAPI";
    import type {DeviceInfoCanvas, ProjectRT} from "../engine/ProjectRT";

    import {projectEngines} from "../engine/Engines";
    import {GridController} from "../hardware/hardware";
    import { WebMidi } from "webmidi";

    import Information from "carbon-icons-svelte/lib/Information.svelte";
    import Close from "carbon-icons-svelte/lib/Close.svelte";

    import Popup from "../components/Popup.svelte";
    import Dropdown from "../components/Dropdown.svelte";
    import Sidebar from "../components/Sidebar.svelte";
    import Multibutton from "../components/Multibutton.svelte";
    import Switch from "../components/Switch.svelte";
    import MobileSidebarButton from "../components/MobileSidebarButton.svelte";
    import LayerSelector from "../components/LayerSelector.svelte";
    import Tutorial from "../components/Tutorial.svelte";
    import TutorialMobile from "../components/TutorialMobile.svelte";
    import Help from "carbon-icons-svelte/lib/Help.svelte";

    import ResizeObserver from "svelte-resize-observer";

    import {SvelteToast, toast} from "@zerodevx/svelte-toast";
    import {t, locale, locales} from "$lib/translations";
    import { themeMode, theme } from "$lib/stores/theme";

    import {browser} from "$app/environment";
    import { page } from "$app/stores";

    import { GoogleAnalytics, ga } from '@beyonk/svelte-google-analytics'

    import {afterUpdate, onMount} from "svelte";
    import "../shared.css";

    const mobileViewWidthThreshold = 800;
    const mobileViewAspectThreshold = 3/5;

    const keyPressColors: { [key: string]: Color } = 
    {
        "color.green": new Color(ColorType.Palette, ["classic", 21]),
        "color.red": new Color(ColorType.Palette, ["classic", 5]),
        "color.blue": new Color(ColorType.Palette, ["classic", 45]),
        "color.cyan": new Color(ColorType.Palette, ["classic", 37]),
        "color.purple": new Color(ColorType.Palette, ["classic", 53]),
        "color.yellow": new Color(ColorType.Palette, ["classic", 13]),
        "color.white": new Color(ColorType.Palette, ["classic", 3])
    }

    // Settings are values that saves
    let settings = {
        virtualDevice: Object.keys(virtualDeviceComponents)[0],
        virtualDeviceScale: "100%",
        projectEngine: "Unipack", //Object.keys(projectEngines)[0],
        devices: [
            { deviceInput: undefined, deviceOutput: undefined, deviceConfig: undefined, deviceSettingAdvanced: false, enabled: true },
            { deviceInput: undefined, deviceOutput: undefined, deviceConfig: undefined, deviceSettingAdvanced: false, enabled: true },
            { deviceInput: undefined, deviceOutput: undefined, deviceConfig: undefined, deviceSettingAdvanced: false, enabled: true },
            { deviceInput: undefined, deviceOutput: undefined, deviceConfig: undefined, deviceSettingAdvanced: false, enabled: true }
        ],
        language: undefined,
        keypressColor: Object.keys(keyPressColors)[0],
    };

    // Options are not somethings being saved
    let options = 
    {
        lightAnimation: true,
        showKeyPress: false,
        learningMode: false
    }
    
    var player_ready = false;

    $: if (browser && player_ready) {
        // console.log("Saving setting");
        localStorage.setItem("settings", JSON.stringify(settings));
    }

    let virtualDeviceComponent: typeof virtualDeviceComponents[number]["component"];
    $: virtualDeviceComponent = 
        virtualDeviceComponents[settings.virtualDevice] 
            ? virtualDeviceComponents[settings.virtualDevice].component 
            : virtualDeviceComponents["Mystrix"].component 


    let engine: ProjectRT;
    let projectStatus: string = "not loaded";

    let virtualDevices: any[] = []; //Should be fine
    let virtualDevicesInfo: DeviceInfoCanvas[] = [];

    let popup: { [key: string]: boolean } = {};

    let mobileView = false;
    let showSidebar = true;
    let showTutorial = false;
    let tutorialMode = false;
    let fakeProjectInfo = null;
    let fakeDemoplay = null;
    let currentProject;
    let currentStatus;
    let currentStep = 0;
    
    $: currentProject = tutorialMode ? {
        projectInfo: fakeProjectInfo, 
        demoplay: fakeDemoplay, 
        currentLayer: 0, 
        LayerChange: () => {},
        totalLayers: 8
    } : engine;
    $: currentStatus = tutorialMode && fakeProjectInfo ? "loaded" : projectStatus;

    const updateDevicesInfo = () => {
        virtualDevicesInfo = [];
        virtualDevices.forEach((device) => {
            virtualDevicesInfo.push({
                id: device.id,
                pos: device.pos,
                info: device.deviceInfo,
            });
        });
    };

    const virtualKeyPressed: KeyPress = (deviceID: number, keyID: KeyID) => {
        console.info(`Virtual Device ${keyID} has been pressed`);
        // device.setColor(keyID, new Color(ColorType.RGB, [255, 255, 255]));
        // console.log(deviceInfo)
        engine?.KeyPress(virtualDevicesInfo[deviceID], keyID);
    };

    const virtualKeyReleased: KeyRelease = (deviceID: number, keyID: KeyID) => {
        console.info(`Virtual Device ${keyID} has been released`);
        // // device.setColor(keyID, new Color(ColorType.RGB, [0, 0, 0]));

        engine?.KeyRelease(virtualDevicesInfo[deviceID], keyID);
    };

    let midiDevices: GridController[] = [];
    let midiDeviceInfos: DeviceInfoCanvas = [];
    let selectedDeviceIndex = 0;
    let selectedDeviceTab = "1";
    let deviceListUpdateTrigger = 0; // Increment this to force device list updates
    
    // Reactive property for current device's advanced mode (read-only)
    $: currentDeviceAdvancedMode = reactiveVars[selectedDeviceIndex]?.deviceSettingAdvanced || false;
    
    // Reactive device lists that update when devices connect/disconnect
    $: availableDevices = browser && deviceListUpdateTrigger >= 0 ? Object.keys(getAvailableDeviceOptions()) : [];
    $: availableInputs = browser && deviceListUpdateTrigger >= 0 ? Object.keys(getAvailableDeviceOptions('inputs')) : [];
    $: availableOutputs = browser && deviceListUpdateTrigger >= 0 ? Object.keys(getAvailableDeviceOptions('outputs')) : [];
    $: availableConfigs = browser && deviceListUpdateTrigger >= 0 ? Object.keys(GridController.configList()) : [];
    
    // Function to update advanced mode
    const updateAdvancedMode = (newValue) => {
        if (reactiveVars[selectedDeviceIndex]) {
            reactiveVars[selectedDeviceIndex].deviceSettingAdvanced = newValue;
            settings.devices[selectedDeviceIndex].deviceSettingAdvanced = newValue;
            reactiveVars = [...reactiveVars]; // Force reactivity
        }
    };
    
    // Function to get available devices for dropdown options (no disconnected devices)
    const getAvailableDeviceOptions = (deviceType = 'devices') => {
        let availableDevices = {};
        
        // Get currently available devices
        switch(deviceType) {
            case 'inputs':
                availableDevices = GridController.availableDeviceInputs();
                break;
            case 'outputs':
                availableDevices = GridController.availableDeviceOutputs();
                break;
            default:
                availableDevices = GridController.availableDevices();
        }
        
        return availableDevices;
    };
    
    // Function to get merged device list (available + saved) - used for display values
    const getMergedDeviceList = (deviceType = 'devices') => {
        let availableDevices = {};
        
        // Get currently available devices
        switch(deviceType) {
            case 'inputs':
                availableDevices = GridController.availableDeviceInputs();
                break;
            case 'outputs':
                availableDevices = GridController.availableDeviceOutputs();
                break;
            default:
                availableDevices = GridController.availableDevices();
        }
        
        const mergedDevices = { ...availableDevices };
        
        // Add saved device configurations that aren't currently available
        settings.devices.forEach((device, index) => {
            let savedDeviceName;
            switch(deviceType) {
                case 'inputs':
                    savedDeviceName = device.deviceInput;
                    break;
                case 'outputs':
                    savedDeviceName = device.deviceOutput;
                    break;
                default:
                    savedDeviceName = device.deviceInput || device.deviceOutput;
            }
            
            if (savedDeviceName && !availableDevices[savedDeviceName]) {
                // Add saved device with parentheses to indicate it's not currently available
                mergedDevices[`(${savedDeviceName})`] = null; // null indicates it's saved but not available
            }
        });
        
        return mergedDevices;
    };
    
    // Function to sync reactive vars with saved settings
    const syncReactiveVarsWithSettings = (deviceIndex) => {
        if (!reactiveVars[deviceIndex]) {
            // console.log('ERROR: reactiveVars[' + deviceIndex + '] is undefined');
            return;
        }
        
        const deviceSettings = settings.devices[deviceIndex];
        // console.log('Syncing device', deviceIndex, 'with settings:', deviceSettings);
        
        // Always start with saved settings first
        const savedDeviceName = deviceSettings?.deviceInput || deviceSettings?.deviceOutput;
        const isDeviceAvailable = savedDeviceName && GridController.availableDevices()[savedDeviceName];
        
        // Show device name with parentheses if saved but not currently available, or undefined if no device
        reactiveVars[deviceIndex].activeDevice = savedDeviceName ? 
            (isDeviceAvailable ? savedDeviceName : `(${savedDeviceName})`) : undefined;
        reactiveVars[deviceIndex].activeInput = deviceSettings?.deviceInput ? 
            (GridController.availableDeviceInputs()[deviceSettings.deviceInput] ? deviceSettings.deviceInput : `(${deviceSettings.deviceInput})`) : undefined;
        reactiveVars[deviceIndex].activeOutput = deviceSettings?.deviceOutput ? 
            (GridController.availableDeviceOutputs()[deviceSettings.deviceOutput] ? deviceSettings.deviceOutput : `(${deviceSettings.deviceOutput})`) : undefined;
        reactiveVars[deviceIndex].activeConfig = deviceSettings?.deviceConfig || undefined;
        reactiveVars[deviceIndex].deviceSettingAdvanced = deviceSettings?.deviceSettingAdvanced || false;
        reactiveVars[deviceIndex].enabled = deviceSettings?.enabled !== undefined ? deviceSettings.enabled : true;
        
        // console.log('Synced reactive vars - activeDevice:', reactiveVars[deviceIndex].activeDevice);
        
        // console.log('Set reactive vars to saved settings:', reactiveVars[deviceIndex]);
        
        // If device is also connected, update with live MIDI device info
        if (midiDevices[deviceIndex]?.outputReady()) {
            // console.log('Device is connected, updating with live info');
            reactiveVars[deviceIndex].activeDevice = midiDevices[deviceIndex]?.name;
            reactiveVars[deviceIndex].activeInput = midiDevices[deviceIndex]?.activeInput?.name;
            reactiveVars[deviceIndex].activeOutput = midiDevices[deviceIndex]?.activeOutput?.name;
            reactiveVars[deviceIndex].activeConfig = midiDevices[deviceIndex]?.activeConfig?.name;
            // Keep the saved advanced mode setting even when connected
        }
        
        // Force Svelte reactivity by reassigning the array
        reactiveVars = [...reactiveVars];
        // console.log('Final reactive vars after sync:', reactiveVars[deviceIndex]);
    };
    
    // Reactive statement to handle device tab changes
    $: if (selectedDeviceTab) {
        selectedDeviceIndex = parseInt(selectedDeviceTab) - 1;
        // console.log('=== DEVICE SWITCH DEBUG ===');
        // console.log('Selected device tab:', selectedDeviceTab);
        // console.log('Selected device index:', selectedDeviceIndex);
        // console.log('Current settings for device:', settings.devices[selectedDeviceIndex]);
        // console.log('Current reactive vars for device (before sync):', reactiveVars[selectedDeviceIndex]);
        
        // Sync reactive vars with current state
        syncReactiveVarsWithSettings(selectedDeviceIndex);
        
        // console.log('Current reactive vars for device (after sync):', reactiveVars[selectedDeviceIndex]);
        // console.log('=== END DEBUG ===');
    }

    const deviceKeyPressed: KeyPress = (deviceID: number, keyID: KeyID) => {
        // Only process input if device is enabled
        if (!settings.devices[deviceID]?.enabled) {
            // console.info(`Device ${deviceID} input ignored - device disabled`);
            return;
        }
        
        // console.info(`Device ${deviceID} Button ${keyID} has been pressed`);
        engine?.KeyPress(midiDeviceInfos[deviceID], keyID);
    };

    const deviceKeyReleased: KeyRelease = (deviceID: number, keyID: KeyID) => {
        // Only process input if device is enabled
        if (!settings.devices[deviceID]?.enabled) {
            // console.info(`Device ${deviceID} input ignored - device disabled`);
            return;
        }
        
        // console.info(`Device ${deviceID} Button ${keyID} has been released`);
        engine?.KeyRelease(midiDeviceInfos[deviceID], keyID);
    };

    const deviceEvent = (event: {}) => {
        // console.log(`Midi Device Event`);
        // console.log(event);
        switch (event.event) {
            case "opened":
                midiDeviceInfos[event.deviceID] = {
                    name: midiDevices[event.deviceID].name,
                    id: event.deviceID,
                    pos: [0, 0],
                    info: midiDevices[event.deviceID].getDeviceInfo(),
                };
                // Update reactive vars for this device
                if (reactiveVars[event.deviceID]) {
                    reactiveVars[event.deviceID].activeDevice = midiDevices[event.deviceID]?.name;
                    reactiveVars[event.deviceID].activeInput =
                        midiDevices[event.deviceID]?.activeInput?.name;
                    reactiveVars[event.deviceID].activeOutput =
                        midiDevices[event.deviceID]?.activeOutput?.name;
                    reactiveVars[event.deviceID].activeConfig =
                        midiDevices[event.deviceID]?.activeConfig?.name;
                }
                toast.push(
                    $t("toast.is_now_connected", {
                        device_name: midiDeviceInfos[event.deviceID].name,
                    }),
                    {
                        theme: {
                            "--toastColor": "#FFFFFF;",
                            "--toastBackground": "#48BB78",
                            "--toastBarBackground": "#2F855A",
                        },
                    }
                );
                break;
            case "closed":
                if (midiDeviceInfos[event.deviceID] != undefined) {
                    //So when user action caused port close (it will set deviceInfo to undefined). No toast will be shown
                    toast.push(
                        $t("toast.is_now_disconnected", {
                            name: midiDeviceInfos[event.deviceID].name,
                        }),
                        {
                            theme: {
                                "--toastColor": "#FFFFFF;",
                                "--toastBackground": "#F56565",
                                "--toastBarBackground": "#C53030",
                            },
                        }
                    );
                }
                midiDeviceInfos[event.deviceID] = undefined;
                // Clear reactive vars for this device
                if (reactiveVars[event.deviceID]) {
                    reactiveVars[event.deviceID].activeDevice = undefined;
                    reactiveVars[event.deviceID].activeInput = undefined;
                    reactiveVars[event.deviceID].activeOutput = undefined;
                    reactiveVars[event.deviceID].activeConfig = undefined;
                }
                break;

            case "connected":
                // Update device lists
                deviceListUpdateTrigger++;
                
                // Check if this device matches any of our configured devices
                for (let i = 0; i < 4; i++) {
                    if (event.device == settings.devices[i].deviceInput) {
                        midiDevices[i].connect(
                            GridController.availableDeviceInputs()[event.device],
                            GridController.availableDeviceOutputs()[event.device],
                            settings.devices[i].deviceConfig
                        );
                        break;
                    }
                }
                break;

            case "disconnected":
                // Update device lists with a small delay to allow WebMIDI to update
                setTimeout(() => {
                    deviceListUpdateTrigger++;
                    
                    // Force update of the current device's reactive vars to reflect disconnection
                    if (browser) {
                        // Update all device reactive vars to show disconnected status
                        for (let i = 0; i < 4; i++) {
                            syncReactiveVarsWithSettings(i);
                        }
                    }
                }, 100); // 100ms delay
                break;
        }
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if(e.repeat) return;

        // Check if the active element is a text input
        const activeElement = document.activeElement;
        const isTextInput = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable ||
            activeElement.getAttribute('contenteditable') === 'true'
        );
        
        if (isTextInput) {
            return; // Don't process shortcuts when typing in text inputs
        }

        // Check if any popup is open - if so, don't process keyboard shortcuts
        const anyPopupOpen = Object.values(popup).some(isOpen => isOpen);
        if (anyPopupOpen) return;

        var keyCode = e.keyCode;
        
        // Layer shortcuts (0-9) only work when project is loaded
        if(keyCode > 47 && keyCode < 58) // 0-9
        {
            if(currentStatus !== "loaded") return;
            e.preventDefault();
            var layer = keyCode == 48 ? 9 : keyCode - 49;
            engine?.LayerChange(layer);
            return
        }
        
        switch(keyCode) {
            case 32: // Space
            case 80: // P
                if(currentStatus !== "loaded") return;
                e.preventDefault();
                engine?.demoplay?.status === "PLAYING" ? engine?.demoplay?.Pause() : engine?.demoplay?.Start();
                break;
            case 37: // Left - Previous Action
            case 65: // A
                if(currentStatus !== "loaded") return;
                e.preventDefault();
                engine?.demoplay?.Pause();
                engine?.demoplay?.Previous();
                break;
            case 39: // Right - Next Action
            case 68: // D
                if(currentStatus !== "loaded") return;
                e.preventDefault();
                engine?.demoplay?.Pause();
                engine?.demoplay?.Next();
                break;
            case 38: // Up - Layer Down
            case 87: // W
            case 69: // E
                if(currentStatus !== "loaded") return;
                e.preventDefault();
                engine?.LayerChange(engine?.currentLayer + 1);
                break;
            case 40: // Down - Layer Up
            case 83: // S
            case 81: // Q
                if(currentStatus !== "loaded") return;
                e.preventDefault();
                engine?.LayerChange(engine?.currentLayer - 1);
                break;
            case 70: // F - Full Screen
            case 13: // Enter
            case 27: // Esc
                e.preventDefault();
                showSidebar = !showSidebar;
                break;
            case 82: // R - Reload
                e.preventDefault();
                loadProject();
                break;
            case 90: // Z - Show Settings
                e.preventDefault();
                if(popup["devices"] || popup["demoplay"]) 
                {
                    popup["devices"] = false;
                    popup["demoplay"] = false;
                }
                popup["setting"] = !popup["setting"];
                break;
            case 72: // H - Show Tutorial
                e.preventDefault();
                currentStep = 0;
                tutorialMode = false;
                fakeProjectInfo = null;
                fakeDemoplay = null;
                showSidebar = true;
                showTutorial = true;
                break;
            case 88: // X - Show Devices
                e.preventDefault();
                if(popup["setting"] || popup["demoplay"]) 
                {
                    popup["setting"] = false;
                    popup["demoplay"] = false;
                }
                popup["devices"] = !popup["devices"];
                break;
            case 67: // C - Show Demo Play Settings
                if(currentStatus !== "loaded") return;
                e.preventDefault();
                if(popup["setting"] || popup["devices"]) 
                {
                    popup["setting"] = false;
                    popup["devices"] = false;
                }
                popup["demoplay"] = !popup["demoplay"];
                break;
            default:
                break;
        }
	}

    // Initialize 4 MIDI device controllers
    for (let i = 0; i < 4; i++) {
        midiDevices[i] = new GridController(i, deviceKeyPressed, deviceKeyReleased);
    }

    const loadProject = () => {
        // console.log("Load File Selector");
        var input = document.createElement("input");
        input.type = "file";
        input.accept = engine.fileFormat;
        input.onchange = (e) => {
            var file = e?.target?.files[0];
            loadProjectFile(file);
        };
        input.click();
    };

    const loadProjectFile = async (file: File, saveToCache: boolean = false) => {
        if (!file) return;
        
        projectStatus = "loading";
        
        try {
            await engine.LoadProjectFile(file);
            // console.log("Project Loaded");
            projectStatus = "loaded";
            
            // Save to cache if requested (for imported projects)
            if (saveToCache) {
                const { downloadedProjectsService } = await import('../lib/services/downloadedProjects');
                await downloadedProjectsService.addDownloadedProject(
                    `local_${Date.now()}`, // Generate unique ID for local imports
                    engine.projectInfo.name,
                    engine.projectInfo.author || 'Unknown',
                    file
                );
                // console.log("Project cached locally");
            }
            
            ga.addEvent('project_loaded', {
                engine: settings.projectEngine,
                file_name: file.name,
                project_name: engine.projectInfo.name,
                source: saveToCache ? 'local_import' : 'local_direct'
            });
        } catch (error) {
            toast.push(
                $t("toast.project_failed_to_load", {project_loading_error: error.toString()}
                ),
                {
                    theme: {
                        "--toastColor": "#FFFFFF;",
                        "--toastBackground": "#F56565",
                        "--toastBarBackground": "#C53030",
                    },
                    duration: 5000
                }
            );
            projectStatus = "not loaded";
            ga.addEvent('project_failed_to_load', {
                engine: settings.projectEngine,
                file_name: file?.name,
                error: error.toString()
            });
        }
    };

    const downloadAndLoadUnipack = async (url: string) => {
        if (!url) return;
        
        projectStatus = "loading";
        
        try {
            toast.push(
                $t("toast.downloading_unipack"),
                {
                    theme: {
                        "--toastColor": "#FFFFFF;",
                        "--toastBackground": "#3182CE",
                        "--toastBarBackground": "#2C5282",
                    },
                }
            );

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
            }
            
            const blob = await response.blob();
            const fileName = url.split('/').pop()?.split('?')[0] || 'unipack.zip';
            const file = new File([blob], fileName, { type: 'application/zip' });
            
            await loadProjectFile(file, true); // Save to cache
            
            toast.push(
                $t("toast.unipack_download_success"),
                {
                    theme: {
                        "--toastColor": "#FFFFFF;",
                        "--toastBackground": "#48BB78",
                        "--toastBarBackground": "#2F855A",
                    },
                }
            );
            
            ga.addEvent('project_loaded_from_url', {
                engine: settings.projectEngine,
                url: url,
                file_name: fileName,
                project_name: engine.projectInfo?.name || 'Unknown'
            });
            
        } catch (error) {
            toast.push(
                $t("toast.unipack_download_failed", { error: error.message }),
                {
                    theme: {
                        "--toastColor": "#FFFFFF;",
                        "--toastBackground": "#F56565",
                        "--toastBarBackground": "#C53030",
                    },
                    duration: 8000
                }
            );
            projectStatus = "not loaded";
            
            ga.addEvent('project_failed_to_load_from_url', {
                engine: settings.projectEngine,
                url: url,
                error: error.toString()
            });
        }
    };

    const handleProjectStoreSelection = (event: CustomEvent) => {
        const { file, projectInfo } = event.detail;
        popup["projectStore"] = false;
        
        // console.log("Project selected from store:", projectInfo.name);
        loadProjectFile(file);
        
        ga.addEvent('project_loaded_from_store', {
            engine: settings.projectEngine,
            project_id: projectInfo.id,
            project_name: projectInfo.name,
            project_author: projectInfo.author
        });
    };

    const importProject = () => {
        // console.log("Import Project - File Selector");
        var input = document.createElement("input");
        input.type = "file";
        input.accept = engine.fileFormat;
        input.onchange = (e) => {
            var file = e?.target?.files[0];
            if (file) {
                loadProjectFile(file, true); // true = save to cache
            }
        };
        input.click();
    };

    const showFakeProject = () => {
        tutorialMode = true;
        fakeProjectInfo = {
            name: "Tutorial Demo",
            author: "Amethyst Player",
            version: "1.0",
            layer: 8
        };
        
        fakeDemoplay = {
            status: "PAUSED",
            progress: 25,
            total: 100,
            Start: () => {
                fakeDemoplay.status = "PLAYING";
                // Simple fake demo play simulation
                const interval = setInterval(() => {
                    if (fakeDemoplay.status === "PLAYING") {
                        fakeDemoplay.progress++;
                        if (fakeDemoplay.progress >= fakeDemoplay.total) {
                            fakeDemoplay.progress = fakeDemoplay.total;
                            fakeDemoplay.status = "PAUSED";
                            clearInterval(interval);
                        }
                    } else {
                        clearInterval(interval);
                    }
                }, 100);
            },
            Pause: () => {
                fakeDemoplay.status = "PAUSED";
            },
            Seek: (position) => {
                fakeDemoplay.progress = Math.max(0, Math.min(position, fakeDemoplay.total));
            },
            Next: () => {
                fakeDemoplay.progress = Math.min(fakeDemoplay.progress + 10, fakeDemoplay.total);
            },
            Previous: () => {
                fakeDemoplay.progress = Math.max(fakeDemoplay.progress - 10, 0);
            }
        };
    };

    let overlays:any[] = [];

    var api: Canvas = {
        setColor: function (deviceID: number, keyID: KeyID, color: Color) {
            var signature = [deviceID, keyID];
            if(!overlays.map(String).includes(signature.toString()))
            {
                // Send to virtual device for the specific deviceID
                virtualDevices[deviceID]?.setColor(keyID, color);
                
                // HYBRID APPROACH: Send to target device + broadcast to all other enabled devices
                
                // 1. Send to the specific device the engine requested (original behavior)
                if (settings.devices[deviceID]?.enabled !== false && midiDevices[deviceID]?.outputReady()) {
                    // console.log('Sending to target device', deviceID);
                    midiDevices[deviceID].setColor(keyID, color);
                }
                
                // 2. Also broadcast to all OTHER enabled devices (multi-device feature)
                for (let i = 0; i < 4; i++) {
                    if (i !== deviceID) { // Skip the target device (already handled above)
                        const isEnabled = settings.devices[i]?.enabled !== false;
                        const isReady = midiDevices[i]?.outputReady();
                        
                        if (isEnabled && isReady) {
                            // console.log('Broadcasting to additional device', i);
                            midiDevices[i].setColor(keyID, color);
                        }
                    }
                }
            }
        },

        setOverlay: function (deviceID: number, keyID: KeyID, color?: Color) {
            var signature = [deviceID, keyID];

            if(color === undefined)
            {
                color = keyPressColors[settings.keypressColor];
            }

            if(!color.isBlack())
            {
                if(!overlays.map(String).includes(signature.toString())) {overlays.push(signature);}
            }
            else
            {
                let index = overlays.map(String).indexOf(signature.toString())
                if(index != -1) {overlays.splice(index, 1);}
            }

            // Send to virtual device for the specific deviceID
            virtualDevices[deviceID]?.setColor(keyID, color);
            
            // HYBRID: Target device + broadcast to others
            // 1. Send to target device
            if (settings.devices[deviceID]?.enabled !== false && midiDevices[deviceID]?.outputReady()) {
                midiDevices[deviceID].setColor(keyID, color);
            }
            // 2. Broadcast to other enabled devices
            for (let i = 0; i < 4; i++) {
                if (i !== deviceID && settings.devices[i]?.enabled !== false && midiDevices[i]?.outputReady()) {
                    midiDevices[i].setColor(keyID, color);
                }
            }
        },

        unsetOverlay(deviceID: number, keyID: KeyID)
        {
            var signature = [deviceID, keyID];
            let index = overlays.map(String).indexOf(signature.toString());
            if(index != -1) {overlays.splice(index, 1);}
            
            // Send to virtual device for the specific deviceID
            virtualDevices[deviceID]?.setColor(keyID, new Color(ColorType.Palette, ["classic", 0]));
            
            // HYBRID: Target device + broadcast to others
            const clearColor = new Color(ColorType.Palette, ["classic", 0]);
            // 1. Send to target device
            if (settings.devices[deviceID]?.enabled !== false && midiDevices[deviceID]?.outputReady()) {
                midiDevices[deviceID].setColor(keyID, clearColor);
            }
            // 2. Broadcast to other enabled devices
            for (let i = 0; i < 4; i++) {
                if (i !== deviceID && settings.devices[i]?.enabled !== false && midiDevices[i]?.outputReady()) {
                    midiDevices[i].setColor(keyID, clearColor);
                }
            }
        },

        clearOverlay: function(targetDeviceID?: number){
            for(let overlay of overlays)
            {
                let [deviceID, keyID] = overlay;
                if(targetDeviceID === undefined || deviceID == targetDeviceID)
                {
                    // Send to virtual device for the specific deviceID
                    virtualDevices[deviceID]?.setColor(keyID, new Color(ColorType.Palette, ["classic", 0]));
                    
                    // HYBRID: Target device + broadcast to others
                    const clearColor = new Color(ColorType.Palette, ["classic", 0]);
                    // 1. Send to target device
                    if (settings.devices[deviceID]?.enabled !== false && midiDevices[deviceID]?.outputReady()) {
                        midiDevices[deviceID].setColor(keyID, clearColor);
                    }
                    // 2. Broadcast to other enabled devices
                    for (let i = 0; i < 4; i++) {
                        if (i !== deviceID && settings.devices[i]?.enabled !== false && midiDevices[i]?.outputReady()) {
                            midiDevices[i].setColor(keyID, clearColor);
                        }
                    }
                }
            }
            overlays = [];
        },

        clear: function (deviceID?: number) {
            // virtualDevices[deviceID].clear(); //TODO: Implentment this
            // midiDevices[deviceID].clear(); //TODO: Implentment this
        },

        getDevices: function () {
            // Return all device info (virtual + all enabled and connected MIDI devices)
            const allDevices = [...virtualDevicesInfo];
            
            // Add all enabled and connected MIDI devices
            for (let i = 0; i < 4; i++) {
                if (settings.devices[i]?.enabled && midiDeviceInfos[i]) {
                    allDevices.push(midiDeviceInfos[i]);
                }
            }
            
            // console.log('Engine getDevices() returning:', allDevices.length, 'devices (', allDevices.filter(d => d.id >= 0).length, 'MIDI enabled)');
            return allDevices;
        },

        options: options
    };

    let reactiveVars = [
        { activeDevice: undefined, activeInput: undefined, activeOutput: undefined, activeConfig: undefined, deviceSettingAdvanced: false, enabled: true },
        { activeDevice: undefined, activeInput: undefined, activeOutput: undefined, activeConfig: undefined, deviceSettingAdvanced: false, enabled: true },
        { activeDevice: undefined, activeInput: undefined, activeOutput: undefined, activeConfig: undefined, deviceSettingAdvanced: false, enabled: true },
        { activeDevice: undefined, activeInput: undefined, activeOutput: undefined, activeConfig: undefined, deviceSettingAdvanced: false, enabled: true }
    ];

    let webMidiAvailable = false;

    if (browser) {
        // console.log('=== INITIAL LOAD DEBUG ===');
        // console.log('Initial settings:', settings);
        // console.log('Initial reactiveVars:', reactiveVars);
        // console.log('Initial selectedDeviceTab:', selectedDeviceTab);
        // console.log('Initial selectedDeviceIndex:', selectedDeviceIndex);
        // console.log('=== END INITIAL DEBUG ===');
        
        // Check if this is first time user
        if (!localStorage.getItem("amethyst_tutorial_completed")) {
            showSidebar = true;
            showTutorial = true;
        }

        if (localStorage.getItem("settings")) {
            const savedSettings = JSON.parse(localStorage.getItem("settings")!);
            // Migrate old settings format to new multi-device format
            if (savedSettings.deviceInput !== undefined) {
                settings.devices[0].deviceInput = savedSettings.deviceInput;
                settings.devices[0].deviceOutput = savedSettings.deviceOutput;
                settings.devices[0].deviceConfig = savedSettings.deviceConfig;
                settings.devices[0].deviceSettingAdvanced = savedSettings.deviceSettingAdvanced || false;
                settings.devices[0].enabled = true; // Enable by default for migrated devices
                delete savedSettings.deviceInput;
                delete savedSettings.deviceOutput;
                delete savedSettings.deviceConfig;
                delete savedSettings.deviceSettingAdvanced;
            }
            // Also migrate standalone deviceSettingAdvanced if it exists
            if (savedSettings.deviceSettingAdvanced !== undefined && savedSettings.devices) {
                // Apply to all devices if not already migrated
                for (let i = 0; i < 4; i++) {
                    if (settings.devices[i].deviceSettingAdvanced === undefined) {
                        settings.devices[i].deviceSettingAdvanced = savedSettings.deviceSettingAdvanced;
                    }
                }
                delete savedSettings.deviceSettingAdvanced;
            }
            settings = { ...settings, ...savedSettings };

            GridController.start(deviceEvent).then((midi_available) => {
                webMidiAvailable = midi_available;
                
                if (midi_available) {
                    toast.push(
                        $t("toast.webmidi_available"),
                        {
                            theme: {
                                "--toastColor": "#FFFFFF;",
                                "--toastBackground": "#48BB78",
                                "--toastBarBackground": "#2F855A",
                            },
                        }
                    );
                    // Connect all configured devices
                    for (let i = 0; i < 4; i++) {
                        const device = settings.devices[i];
                        if (device.deviceInput && device.deviceOutput) {
                            midiDevices[i].connect(
                                GridController.availableDeviceInputs()[device.deviceInput],
                                GridController.availableDeviceOutputs()[device.deviceOutput],
                                GridController.configList()[device.deviceConfig!]
                            );
                        }
                    }
                } else {
                    toast.push(
                        $t("toast.webmidi_unavailable"),
                        {
                            theme: {
                                "--toastColor": "#FFFFFF;",
                                "--toastBackground": "#F56565",
                                "--toastBarBackground": "#C53030",
                            },
                            duration: 10000
                        }
                    );
                }
            })

            // console.log(settings);
        }

        player_ready = true;
        if(projectEngines[settings.projectEngine] === undefined)
        {
            settings.projectEngine = Object.keys(projectEngines)[0]; //Revert to the first one
        }
        engine = projectEngines[settings.projectEngine](api);
        
        // Check for unipack_url parameter and automatically download/load
        if ($page.url.searchParams.has('unipack_url')) {
            const unipackUrl = $page.url.searchParams.get('unipack_url');
            if (unipackUrl) {
                // Small delay to ensure everything is initialized
                setTimeout(() => {
                    downloadAndLoadUnipack(unipackUrl);
                }, 1000);
            }
        }
    }

    onMount(() => {
            setInterval(() => {
                if (reactiveVars[selectedDeviceIndex] && reactiveVars[selectedDeviceIndex].activeConfig != midiDevices[selectedDeviceIndex]?.activeConfig?.name)
                    reactiveVars[selectedDeviceIndex].activeConfig = midiDevices[selectedDeviceIndex]?.activeConfig?.name;
            }, 1000 / 30);
        }
    );

    afterUpdate(() => {
        updateDevicesInfo();
    });

    // Update body theme attribute
    $: if (browser && $theme) {
        document.body.setAttribute('data-theme', $theme);
    }

    function onResize(e) {
        let width = e.detail.clientWidth;
        let height = e.detail.clientHeight;
        let newMobileView = width/height <= mobileViewAspectThreshold || width < mobileViewWidthThreshold;

        if(newMobileView != mobileView)
        {
            mobileView = newMobileView;
            // Ensure sidebar is shown when switching to mobile view
            if(newMobileView) {
                showSidebar = true;
            }
        }
    }
</script>

<main>
    <GoogleAnalytics properties={[ 'G-QQCVL9EZHF' ]} />
    <div class="toast {mobileView ? 'mobile': ''}">
        <SvelteToast options={{pausable: true, intro: mobileView ? { y: -192 } : undefined}}/>
    </div>
    {#if player_ready}
        {#if mobileView}
            <div class="mobile-header">
                <div class="amethyst-bar center-class">
                    <img src="logo-256.png">

                    <div style="margin-left: 10px">
                        <span>Amethyst</span>
                    </div>
                </div>

                <div class="show-controls-icon-parent center-class">
                    <MobileSidebarButton bind:checked={showSidebar}/>
                </div>
            </div>
        {/if}
        <div class="main-content">
            <ResizeObserver on:resize={onResize} />
            <Sidebar
                    on:settings={() => (popup["setting"] = true)}
                    on:devices={() => (popup["devices"] = true)}
                    on:demoplay={() => (popup["demoplay"] = true)}
                    on:loadProject={() => {loadProject();}}
                    on:openProjectStore={() => (popup["projectStore"] = true)}
                    on:openDownloadedProjects={() => (popup["downloadedProjects"] = true)}
                    bind:project={currentProject}
                    bind:status={currentStatus}
                    bind:show={showSidebar}
                    bind:mobile={mobileView}
            />

            <div class="content-part" on:click={(e) => {if(!mobileView)showSidebar = !showSidebar}}>
                <div class="amethyst-player-content {mobileView ? 'mobile' : ''}" >
                    <div class="amethyst-player-launchpad-holder center-class">
                        <div
                                style={`width: 85%; max-width: ${50 * parseInt(settings.virtualDeviceScale) / 100}dvh;`}
                                class="center-class virtual-device-container"
                                on:click={(e) => {e.stopPropagation()}}
                        >
                                <svelte:component
                                        this={virtualDeviceComponent}
                                        bind:this={virtualDevices[0]}
                                        id={0}
                                        pos={[0, 0]}
                                        keyPress={virtualKeyPressed}
                                        keyRelease={virtualKeyReleased}
                                />
                        </div>
                    </div>
                </div>
                <div class="amethyst-player-footer center-class" on:click={(e) => {e.stopPropagation()}}>
                {#if currentStatus === "loaded"}
                    <LayerSelector bind:project={currentProject}/>
                {:else}
                    <span title= {__BUILD_STRING__}>
                        {`Amethyst Player`}
                    </span>
                {/if}
                </div>
            </div>
        </div>
    {/if}

    {#if popup["setting"]}
        <div class="settings-overlay" on:click={() => popup["setting"] = false}>
            <div class="settings-modal" on:click|stopPropagation>
                <div class="modal-header">
                    <h2>{$t("setting.settings")}</h2>
                    <div class="header-buttons">
                        <button class="close-button" on:click={() => popup["setting"] = false}>
                            <Close size={24} />
                        </button>
                    </div>
                </div>

                <div class="settings-content">
                    <div class="setting {mobileView? 'mobile' : ''}">
                        <div class="setting-name">
                            <span>{$t("setting.virtual_device")}</span>
                        </div>

                        <div class="setting-option">
                            <Dropdown
                                    bind:value={settings.virtualDevice}
                                    options={Object.keys(virtualDeviceComponents)}
                            />
                        </div>
                    </div>

                    <div class="setting {mobileView? 'mobile' : ''}">
                        <div class="setting-name">
                            <span>{$t("setting.virtual_device_Scale")}</span>
                        </div>

                        <div class="setting-option">
                            <Multibutton
                                    bind:value={settings.virtualDeviceScale}
                                    options={["50%", "75%", "100%", "125%", "150%"]}
                            />
                        </div>
                    </div>

                    <div class="setting {mobileView? 'mobile' : ''}">
                        <div class="setting-name">
                            <span>{$t("setting.project_engine")}</span>
                        </div>

                        <div class="setting-option">
                            <Dropdown
                                bind:value={settings.projectEngine}
                                options={Object.keys(projectEngines)}
                                on:change={() => {
                                engine =
                                    projectEngines[settings.projectEngine](api);
                                }}
                            />
                        </div>
                    </div>

                    <div class="setting {mobileView? 'mobile' : ''}">
                        <div class="setting-name">
                            <span>{$t("setting.language")}</span>
                        </div>

                        <div class="setting-option">
                            <Dropdown
                                value={$t(`lang.${locale.get()}`)}
                                options={$locales.map((x) =>
                                    $t(`lang.${x}`)
                                )}
                                on:change={(e) => {
                                $locale = $locales[e.detail.index];
                                settings.language = $locales[e.detail.index];
                                }}
                            />
                        </div>
                    </div>

                    <div class="setting {mobileView? 'mobile' : ''}">
                        <div class="setting-name">
                            <span>{$t("setting.theme")}</span>
                        </div>

                        <div class="setting-option">
                            <Dropdown
                                value={$themeMode === 'auto' ? $t('setting.theme_auto') : $themeMode === 'light' ? $t('setting.theme_light') : $t('setting.theme_dark')}
                                options={[$t('setting.theme_auto'), $t('setting.theme_light'), $t('setting.theme_dark')]}
                                on:change={(e) => {
                                    const themes = ['auto', 'light', 'dark'];
                                    $themeMode = themes[e.detail.index];
                                }}
                            />
                        </div>
                    </div>

                    <div class="setting {mobileView? 'mobile' : ''}">
                        <div class="setting-name">
                            <span>{$t('tutorial.help_and_tutorial')}</span>
                        </div>

                        <div class="setting-option">
                            <div class="help-button" on:click={() => { 
                                popup["setting"] = false; 
                                currentStep = 0; 
                                tutorialMode = false;
                                fakeProjectInfo = null;
                                fakeDemoplay = null;
                                showSidebar = true;
                                showTutorial = true; 
                            }}>
                                <Help size={20} />
                                <span>{$t('tutorial.show_tutorial')}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="build-info">
                        <span>{__BUILD_STRING__}</span>
                    </div>
                </div>
            </div>
        </div>
    {/if}

    {#if popup["devices"]}
        <div class="settings-overlay" on:click={() => popup["devices"] = false}>
            <div class="settings-modal" on:click|stopPropagation>
                <div class="modal-header">
                    <h2>{$t("device.device")}</h2>
                    <div class="header-buttons">
                        <div class="device-selector-header">
                            <Multibutton 
                                options={["1", "2", "3", "4"]}
                                bind:value={selectedDeviceTab}
                                class="device-selector"
                            />
                        </div>
                        <button class="close-button" on:click={() => popup["devices"] = false}>
                            <Close size={24} />
                        </button>
                    </div>
                </div>

                <div class="settings-content">
                    {#if !webMidiAvailable}
                        <div class="webmidi-unavailable-container">
                            <div class="error-icon">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="15" y1="9" x2="9" y2="15"/>
                                    <line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                            </div>
                            <h3>{$t('device.webmidi_unavailable_title')}</h3>
                            <p class="preserve-newlines">{$t('device.webmidi_unavailable_description')}</p>
                        </div>
                    {:else}

                        <!-- Device settings for selected device -->
                        <div class="device-settings">
                            <!-- Device enable toggle -->
                            <div class="setting {mobileView? 'mobile' : ''}">
                                <div class="setting-name">
                                    <span>{$t("device.enable_device")} {selectedDeviceIndex + 1}</span>
                                </div>

                                <div class="setting-option">
                                    <Switch 
                                        checked={reactiveVars[selectedDeviceIndex]?.enabled || false}
                                        on:change={(e) => {
                                            settings.devices[selectedDeviceIndex].enabled = e.detail.checked;
                                            reactiveVars[selectedDeviceIndex].enabled = e.detail.checked;
                                            reactiveVars = [...reactiveVars]; // Force reactivity
                                            
                                            if (!e.detail.checked) {
                                                // Disconnect when disabled
                                                midiDevices[selectedDeviceIndex]?.disconnect();
                                            } else {
                                                // Reconnect when enabled
                                                const device = settings.devices[selectedDeviceIndex];
                                                if (device.deviceInput && GridController.availableDevices()[device.deviceInput]) {
                                                    midiDevices[selectedDeviceIndex].connectDevice(
                                                        GridController.availableDevices()[device.deviceInput]
                                                    );
                                                }
                                            }
                                            
                                            // console.log('Device', selectedDeviceIndex + 1, 'enabled:', e.detail.checked);
                                        }}
                                    />
                                </div>
                            </div>
                                    {#if !currentDeviceAdvancedMode}
                                        <div class="setting {mobileView? 'mobile' : ''}">
                                            <div class="setting-name">
                                                <span>{$t("device.midi_device")}</span>
                                            </div>

                                            <div class="setting-option">
                                                <Dropdown
                                                        value={reactiveVars[selectedDeviceIndex]?.activeDevice}
                                                        options={availableDevices}
                                                        placeholder={$t("device.no_device")}
                                                        on:change={(e) => {
                                                        // console.log('Device dropdown changed:', e.detail.value, 'for device index:', selectedDeviceIndex);
                                                        
                                                        // Handle saved devices (in parentheses) and empty selection
                                                        let deviceName = e.detail.value;
                                                        if (deviceName === '' || deviceName === null || deviceName === undefined) {
                                                            // No device selected - clear everything
                                                            deviceName = undefined;
                                                            // console.log('No device selected - clearing configuration');
                                                        } else if (deviceName && deviceName.startsWith('(') && deviceName.endsWith(')')) {
                                                            // Remove parentheses from saved device name
                                                            deviceName = deviceName.slice(1, -1);
                                                            // console.log('Selected saved device (not currently available):', deviceName);
                                                        }
                                                        
                                                        settings.devices[selectedDeviceIndex].deviceInput = deviceName;
                                                        settings.devices[selectedDeviceIndex].deviceOutput = deviceName;
                                                        // console.log('Updated settings.devices[' + selectedDeviceIndex + ']:', settings.devices[selectedDeviceIndex]);
                                                        
                                                        if (deviceName && GridController.availableDevices()[deviceName]) {
                                                            // Device is currently available - connect it
                                                            midiDeviceInfos[selectedDeviceIndex] = undefined;
                                                            midiDevices[selectedDeviceIndex].connectDevice(
                                                                GridController.availableDevices()[deviceName]
                                                            );
                                                        } else {
                                                            // No device selected or device not available - disconnect
                                                            midiDevices[selectedDeviceIndex].disconnect();
                                                            if (deviceName) {
                                                                // console.log('Device saved but not currently available:', deviceName);
                                                            }
                                                        }
                                                        // Sync UI with updated settings
                                                        syncReactiveVarsWithSettings(selectedDeviceIndex);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    {:else}
                                        <div class="setting {mobileView? 'mobile' : ''}">
                                            <div class="setting-name">
                                                <span>{$t("device.midi_input_device")}</span>
                                            </div>

                                            <div class="setting-option">
                                                <Dropdown
                                                        value={reactiveVars[selectedDeviceIndex]?.activeInput}
                                                        options={availableInputs}
                                                        placeholder={$t("device.no_device")}
                                                        on:change={(e) => {
                                                        let deviceName = e.detail.value;
                                                        if (deviceName === '' || deviceName === null || deviceName === undefined) {
                                                            deviceName = undefined;
                                                        } else if (deviceName && deviceName.startsWith('(') && deviceName.endsWith(')')) {
                                                            deviceName = deviceName.slice(1, -1);
                                                        }
                                                        
                                                        settings.devices[selectedDeviceIndex].deviceInput = deviceName;
                                                        midiDeviceInfos[selectedDeviceIndex] = undefined;
                                                        
                                                        if (deviceName && GridController.availableDeviceInputs()[deviceName]) {
                                                            midiDevices[selectedDeviceIndex].connect(
                                                                GridController.availableDeviceInputs()[deviceName],
                                                                midiDevices[selectedDeviceIndex].activeOutput,
                                                                midiDevices[selectedDeviceIndex].activeConfig
                                                            );
                                                        }
                                                        syncReactiveVarsWithSettings(selectedDeviceIndex);
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div class="setting {mobileView? 'mobile' : ''}">
                                            <div class="setting-name">
                                                <span>{$t("device.midi_output_device")}</span>
                                            </div>

                                            <div class="setting-option">
                                                <Dropdown
                                                        value={reactiveVars[selectedDeviceIndex]?.activeOutput}
                                                        options={availableOutputs}
                                                        placeholder={$t("device.no_device")}
                                                        on:change={(e) => {
                                                        let deviceName = e.detail.value;
                                                        if (deviceName === '' || deviceName === null || deviceName === undefined) {
                                                            deviceName = undefined;
                                                        } else if (deviceName && deviceName.startsWith('(') && deviceName.endsWith(')')) {
                                                            deviceName = deviceName.slice(1, -1);
                                                        }
                                                        
                                                        settings.devices[selectedDeviceIndex].deviceOutput = deviceName;
                                                        midiDeviceInfos[selectedDeviceIndex] = undefined;
                                                        
                                                        if (deviceName && GridController.availableDeviceOutputs()[deviceName]) {
                                                            midiDevices[selectedDeviceIndex].connect(
                                                                midiDevices[selectedDeviceIndex].activeInput,
                                                                GridController.availableDeviceOutputs()[deviceName],
                                                                midiDevices[selectedDeviceIndex].activeConfig
                                                            );
                                                        }
                                                        syncReactiveVarsWithSettings(selectedDeviceIndex);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    {/if}

                                    <div class="setting {mobileView? 'mobile' : ''}">
                                        <div class="setting-name">
                                            <span>{$t("device.midi_device_config")}</span>
                                        </div>

                                        <div class="setting-option">
                                            <Dropdown
                                                    value={reactiveVars[selectedDeviceIndex]?.activeConfig}
                                                    options={availableConfigs}
                                                    placeholder={$t("device.no_config")}
                                                    on:change={(e) => {
                                                    settings.devices[selectedDeviceIndex].deviceConfig = e.detail.value;
                                                    if (e.detail.value) {
                                                        midiDeviceInfos[selectedDeviceIndex] = undefined;
                                                        midiDevices[selectedDeviceIndex].connect(
                                                            midiDevices[selectedDeviceIndex].activeInput,
                                                            midiDevices[selectedDeviceIndex].activeOutput,
                                                            GridController.configList()[e.detail.value]
                                                        );
                                                    } else {
                                                        midiDevices[selectedDeviceIndex].disconnect();
                                                    }
                                                    syncReactiveVarsWithSettings(selectedDeviceIndex);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div class="setting {mobileView? 'mobile' : ''}">
                                        <div class="setting-name">
                                            <span>{$t("device.advanced_mode")}</span>
                                        </div>

                                        <div class="setting-option">
                                            <Switch 
                                            checked={currentDeviceAdvancedMode}
                                            on:change={(e) => {
                                                updateAdvancedMode(e.detail.checked);
                                                // console.log('Advanced mode changed for device', selectedDeviceIndex, ':', e.detail.checked);
                                            }}
                                        />
                                        </div>
                                    </div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}

    {#if popup["demoplay"]}
        <div class="settings-overlay" on:click={() => popup["demoplay"] = false}>
            <div class="settings-modal" on:click|stopPropagation>
                <div class="modal-header">
                    <h2>{$t("demoplay.demoplay")}</h2>
                    <div class="header-buttons">
                        <button class="close-button" on:click={() => popup["demoplay"] = false}>
                            <Close size={24} />
                        </button>
                    </div>
                </div>

                <div class="settings-content">
                    <div class="setting {mobileView? 'mobile' : ''}">
                        <div class="setting-name">
                            <span>{$t("demoplay.light_animation")}</span>
                        </div>

                        <div class="setting-option">
                            <Switch bind:checked={options.lightAnimation}/>
                        </div>
                    </div>

                    <div class="setting {mobileView? 'mobile' : ''}">
                        <div class="setting-name">
                            <span>{$t("demoplay.show_key_press")}</span>
                        </div>

                        <div class="setting-option">
                            <Switch bind:checked={options.showKeyPress}
                            on:change={(e) => {
                                if(!e.detail.checked){options.learningMode = false; api.clearOverlay();}
                                else { engine.demoplay?.showActionKeys();} //NOTE THIS IS NOT A STANDARD PROJECTRT API}
                            }} 
                            />
                        </div>
                    </div>

                    <div class="setting {mobileView? 'mobile' : ''}">
                        <div class="setting-name">
                            <span>{$t("demoplay.key_press_color")}</span>
                        </div>

                        <div class="setting-option">
                            <Dropdown
                                bind:value={settings.keypressColor}
                                options={Object.keys(keyPressColors)}
                            />
                        </div>
                    </div>

                    <div class="setting {mobileView? 'mobile' : ''}">
                        <div
                                class="setting-name"
                                title={$t("demoplay.learning_mode_info")}
                        >
                            <span>{$t("demoplay.learning_mode")}</span>
                            <Information
                                    size={14}
                                    style="margin-left: 4px; margin-top: 2px; color:#A0A0A0;"
                            />
                        </div>

                        <div class="setting-option">
                            <Switch bind:checked={options.learningMode}
                                on:change={(e) => {
                                    if(e.detail.checked){
                                        options.showKeyPress = true;
                                        engine.demoplay?.showActionKeys() //NOTE THIS IS NOT A STANDARD PROJECTRT API
                                    }
                                }} 
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    {/if}

    {#if popup["projectStore"]}
        {#await import("../components/ProjectStore.svelte") then ProjectStoreModule}
            <ProjectStoreModule.default 
                bind:show={popup["projectStore"]}
                on:projectSelected={handleProjectStoreSelection}
                on:close={() => popup["projectStore"] = false}
            />
        {/await}
    {/if}

    {#if popup["downloadedProjects"]}
        {#await import("../components/DownloadedProjects.svelte") then DownloadedProjectsModule}
            <DownloadedProjectsModule.default 
                bind:show={popup["downloadedProjects"]}
                on:projectSelected={handleProjectStoreSelection}
                on:importProject={() => {
                    popup["downloadedProjects"] = false;
                    importProject();
                }}
                on:close={() => popup["downloadedProjects"] = false}
            />
        {/await}
    {/if}

    {#if mobileView}
        <TutorialMobile 
            bind:show={showTutorial} 
            bind:currentStep={currentStep}
            on:close={() => {
                localStorage.setItem("amethyst_tutorial_completed", "true");
                showTutorial = false;
                // Clean up tutorial mode
                tutorialMode = false;
                fakeProjectInfo = null;
                fakeDemoplay = null;
                currentStep = 0;
            }}
            on:openSettings={() => { popup["setting"] = true; }}
            on:openDevices={() => { popup["devices"] = true; }}
            on:openDemoplay={() => { popup["demoplay"] = true; }}
            on:showFakeProject={() => { showFakeProject(); }}
            on:hideSidebar={() => { showSidebar = false; }}
            on:showSidebar={() => { showSidebar = true; }}
        />
    {:else}
        <Tutorial 
            bind:show={showTutorial} 
            bind:currentStep={currentStep}
            on:close={() => {
                localStorage.setItem("amethyst_tutorial_completed", "true");
                showTutorial = false;
                // Clean up tutorial mode
                tutorialMode = false;
                fakeProjectInfo = null;
                fakeDemoplay = null;
                currentStep = 0;
            }}
            on:openSettings={() => { popup["setting"] = true; }}
            on:openDevices={() => { popup["devices"] = true; }}
            on:openDemoplay={() => { popup["demoplay"] = true; }}
            on:showFakeProject={() => { showFakeProject(); }}
        />
    {/if}
</main>

<style lang="scss">
    // Theme colors are now managed by the centralized theme system in lib/theme/

    main {
        background-color: var(--bg2, #ffffff);
        height: 100dvh;
        width: 100dvw;
        color: var(--text1);
        overflow: hidden;
    }

    .center-class {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .main-content {
        display: flex;
        flex-direction: row;
        justify-content: space-between;

        .content-part {
            width: 100%;
            max-width: 100vw;
        }
    }

    .amethyst-player-content {
        height: calc(100dvh - 100px);
        width: 100%;
        background-color: var(--bg2, #ffffff);

        overflow: auto;

        &.mobile{
            height: calc(100dvh - 160px);
        }

        .amethyst-player-launchpad-holder {
            height: calc(100%);
            overflow: hidden;

            .circular-loader-bottom-text {
                font-family: 'Roboto', sans-serif;
                font-style: normal;
                font-weight: 300;
                font-size: 20px;
                color: var(--text2);
            }
        }
    }

    .amethyst-player-footer {
        height: 100px;
        width: 100%;
        flex-direction: column;
        gap: 10px;

        span {
            font-size: 18px;

            font-family: "Roboto", sans-serif;
            color: var(--text2);
            font-weight: 300;

            a {
                color: var(--selected);

                &:hover {
                    color: var(--text1);
                }
            }
        }
    }

    .settings-overlay {
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

    .settings-modal {
        background-color: var(--bg1);
        border-radius: 12px;
        width: min(90vw, 600px);
        max-height: min(85vh, 700px);
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
            font-family: "Roboto", sans-serif;
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
        
        .device-selector-header {
            display: flex;
            align-items: center;
        }
        
        :global(.device-selector button) {
            padding: 0 20px !important;
            height: 36px !important;
        }
    }

    .device-settings {
        display: flex;
        flex-direction: column;
        gap: 20px;

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
    }

    .settings-content {
        padding: 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .setting {
        height: 35px;
        display: flex;
        align-items: center;

        .setting-name {
            width: 250px;
            display: flex;
            align-items: center;
            color: var(--text1);
            font-family: "Roboto", sans-serif;
            font-weight: 400;
        }

        .setting-option {
            min-width: 300px;
            display: flex;
            flex-direction: row-reverse;
        }

        &.mobile {
            flex-direction: column;
            height: auto;
            gap: 10px;

            .setting-name {
                width: 100%;
            }

            .setting-option {
                width: 100%;
                flex-direction: row;
            }
        }
    }

    .help-button {
        display: flex !important;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background-color: inherit !important;
        border: 2px solid var(--bg4) !important;
        border-radius: 8px;
        color: var(--text2) !important;
        cursor: pointer;
        transition: background-color 0.2s, color 0.2s, border-color 0.2s;
        font-family: "Roboto", sans-serif !important;
        font-size: 14px !important;
        text-decoration: none;
        outline: none;

        &:hover {
            background-color: var(--bg3) !important;
            border-color: var(--bg4) !important;
            color: var(--text1) !important;
        }

        &:active {
            background-color: var(--bg4) !important;
            color: var(--text1) !important;
        }

        span {
            color: inherit !important;
            font-family: inherit !important;
            font-size: inherit !important;
            font-weight: 500;
        }
    }

    .build-info {
        padding-top: 20px;
        border-top: 1px solid var(--bg3);
        text-align: center;
        display: flex;
        justify-content: center;
        align-items: center;

        span {
            font-family: "Roboto", sans-serif;
            font-size: 14px;
            color: var(--text2);
            font-weight: 300;
        }
    }


    .webmidi-unavailable-container {
        text-align: center;
        padding: 40px 20px;

        .error-icon {
            color: #ef4444;
            margin: 0 auto 24px auto;
            display: flex;
            justify-content: center;
            animation: pulse 2s infinite;
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
            margin: 0;
            max-width: 400px;
            margin: 0 auto;
        }

        .preserve-newlines {
            white-space: pre-line;
        }
    }

    @keyframes pulse {
        0%, 100% {
            opacity: 1;
        }
        50% {
            opacity: 0.5;
        }
    }

    .toast {
        display: contents;
        font-family: "Roboto", sans-serif;
        font-style: normal;
        font-size: 16px;
        font-weight: 300;
        --toastWidth: 20rem;
        --toastColor: var(--text1);
        --toastBackground: var(--bg3);
        --toastBarBackground: var(--bg4);

        &.mobile
        {
            --toastWidth: 100dvw;
            --toastHeight: 4rem;
            --toastContainerTop: 0;
            --toastContainerLeft: 0;
        }
    }

    .mobile-header {
        height: 60px;

        background-color: var(--bg-secondary);

        .show-controls-icon-parent {
            position: fixed;

            height: 60px;
            width: 60px;
        }

        .amethyst-bar {
            position: fixed;

            height: 60px;
            width: 100%;

            img {
                height: 52px;
            }

            span {
                font-family: 'Roboto', sans-serif;
                font-style: normal;
                font-weight: 300;
                font-size: 22px;

                letter-spacing: 0.125rem;
                color: var(--text1);
            }
        }
    }
</style>

<svelte:window on:keydown={onKeyDown} />
