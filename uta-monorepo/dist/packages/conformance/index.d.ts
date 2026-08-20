export interface ConformanceResult {
    total: number;
    passed: number;
    failed: number;
    results: Array<{
        test: string;
        passed: boolean;
        reason?: string;
    }>;
}
export declare function runConformance(caKeyPair?: any): ConformanceResult;
export declare function conformanceMatrix(): {
    format: string;
    parse: boolean;
    detect: boolean;
    schema: boolean;
    crypto: boolean;
    pop: boolean;
    provenance: boolean;
    revocation: boolean;
    roundtrip: boolean;
}[];
