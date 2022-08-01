import type { DeviceInfo, KeyID } from "src/types/devices";
export type { DeviceInfo, KeyID } from "src/types/devices";

import type { Canvas, DeviceInfoCanvas } from "./CanvasAPI"
export type { Canvas, DeviceInfoCanvas } from "./CanvasAPI"

export interface ProjectInfo{
    name: string;
    author: string; //TODO we can have a number type for user ID
}

export interface ProjectRT {
    constructor: (api: Canvas) => void;

    //Meta
    LoadProjectFile: (file: File) => Promise<void>;
    ClearProjectFile: () => void;

    //Input
    KeyPress: (device: DeviceInfoCanvas, keyID:KeyID) => void;
    KeyRelease: (device: DeviceInfoCanvas, keyID:KeyID) => void;
    ChainChange: (chain:number) => void;

    // Info
    readonly currentChain: number;
    readonly projectInfo: ProjectInfo;

    //Autoplay
    Autoplay?: 
    {
        readonly loaded: boolean;
        readonly progress: number;
        readonly total: number;
        Start: () => void;
        Stop: () => void;
        Next: () => void;
        Previous: () => void;
        Seek: (position: number) => void;
    }
}
