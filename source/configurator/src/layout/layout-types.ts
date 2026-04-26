import type { ButtonCode } from '@model/button-codes.ts';

export interface ScreenDescriptor {
    svgElementId: string;
    widthPx: number;
    heightPx: number;
    colorDisplay: boolean;
}

export interface ButtonDescriptor {
    svgElementId: string;
    buttonCode: ButtonCode;
    friendlyName: string;
}

export interface RemoteLayout {
    name: string;
    /** Loaded SVG markup, inlined so individual elements are real DOM nodes. */
    svgContent: string;
    screen: ScreenDescriptor;
    buttons: ButtonDescriptor[];
}
