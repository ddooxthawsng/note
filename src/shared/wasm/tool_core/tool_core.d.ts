/* tslint:disable */
/* eslint-disable */

export function count_words(html: string): number;

export function format_bytes(bytes: number): string;

export function infer_mime_type(file_name: string, provided: string): string;

export function part_count(size: number, part_size?: number | null): number;

export function password_strength(pw: string): number;

export function plan_telegram_parts_json(size: number, part_size?: number | null): string;

export function sha256_hex(input: string): string;

export function validate_manifest_json(raw: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly count_words: (a: number, b: number) => number;
    readonly format_bytes: (a: number) => [number, number];
    readonly infer_mime_type: (a: number, b: number, c: number, d: number) => [number, number];
    readonly part_count: (a: number, b: number, c: number) => number;
    readonly password_strength: (a: number, b: number) => number;
    readonly plan_telegram_parts_json: (a: number, b: number, c: number) => [number, number];
    readonly sha256_hex: (a: number, b: number) => [number, number];
    readonly validate_manifest_json: (a: number, b: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
