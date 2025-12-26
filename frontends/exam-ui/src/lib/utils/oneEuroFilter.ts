/**
 * One Euro Filter Implementation
 * 
 * A low-pass filter designed to smooth noisy signals while minimizing latency.
 * Perfect for real-time landmark tracking where we need responsiveness but
 * also want to reduce jitter.
 * 
 * Paper: "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems"
 * 
 * Key features:
 * - Adaptive cutoff frequency: faster movements = less filtering = less lag
 * - Slower movements = more filtering = smoother output
 * - Tunable via minCutoff (jitter reduction) and beta (lag reduction)
 */

export interface OneEuroFilterConfig {
    /** Minimum cutoff frequency (Hz). Lower = more smoothing for slow movements. Default: 1.0 */
    minCutoff?: number;
    /** Speed coefficient. Higher = more responsive to quick movements. Default: 0.007 */
    beta?: number;
    /** Cutoff frequency for derivative (Hz). Usually fixed. Default: 1.0 */
    dCutoff?: number;
}

interface LowPassFilter {
    y: number | null;
    alpha: number;
    initialized: boolean;
}

/**
 * Compute filter alpha from cutoff frequency and sampling rate
 */
function smoothingFactor(te: number, cutoff: number): number {
    const r = 2 * Math.PI * cutoff * te;
    return r / (r + 1);
}

/**
 * Apply low pass filter to new value
 */
function lowPassFilter(
    filter: LowPassFilter,
    x: number,
    alpha: number
): number {
    if (filter.y === null || !filter.initialized) {
        filter.y = x;
        filter.initialized = true;
    } else {
        filter.y = alpha * x + (1 - alpha) * filter.y;
    }
    return filter.y;
}

/**
 * One Euro Filter for a single value
 */
export class OneEuroFilter {
    private readonly minCutoff: number;
    private readonly beta: number;
    private readonly dCutoff: number;

    private lastTime: number | null = null;
    private xFilter: LowPassFilter = { y: null, alpha: 0, initialized: false };
    private dxFilter: LowPassFilter = { y: null, alpha: 0, initialized: false };

    constructor(config: OneEuroFilterConfig = {}) {
        this.minCutoff = config.minCutoff ?? 1.0;
        this.beta = config.beta ?? 0.007;
        this.dCutoff = config.dCutoff ?? 1.0;
    }

    /**
     * Filter a new value with timestamp
     * @param x Raw value
     * @param timestamp Current timestamp in ms
     * @returns Filtered value
     */
    filter(x: number, timestamp: number): number {
        // Calculate time delta
        let te = 0;
        if (this.lastTime !== null) {
            te = (timestamp - this.lastTime) / 1000; // Convert to seconds
        }
        this.lastTime = timestamp;

        // Handle zero or negative time delta
        if (te <= 0) {
            te = 0.016; // ~60 FPS fallback
        }

        // Compute derivative
        const dx = this.xFilter.initialized && te > 0
            ? (x - (this.xFilter.y ?? x)) / te
            : 0;

        // Apply low-pass filter to derivative
        const smoothedDx = lowPassFilter(
            this.dxFilter,
            dx,
            smoothingFactor(te, this.dCutoff)
        );

        // Compute adaptive cutoff based on speed
        const cutoff = this.minCutoff + this.beta * Math.abs(smoothedDx);

        // Apply low-pass filter to value with adaptive cutoff
        return lowPassFilter(
            this.xFilter,
            x,
            smoothingFactor(te, cutoff)
        );
    }

    /**
     * Reset filter state
     */
    reset(): void {
        this.lastTime = null;
        this.xFilter = { y: null, alpha: 0, initialized: false };
        this.dxFilter = { y: null, alpha: 0, initialized: false };
    }
}

/**
 * One Euro Filter for 2D coordinates (x, y)
 */
export class OneEuroFilter2D {
    private xFilter: OneEuroFilter;
    private yFilter: OneEuroFilter;

    constructor(config: OneEuroFilterConfig = {}) {
        this.xFilter = new OneEuroFilter(config);
        this.yFilter = new OneEuroFilter(config);
    }

    filter(x: number, y: number, timestamp: number): { x: number; y: number } {
        return {
            x: this.xFilter.filter(x, timestamp),
            y: this.yFilter.filter(y, timestamp)
        };
    }

    reset(): void {
        this.xFilter.reset();
        this.yFilter.reset();
    }
}

/**
 * One Euro Filter for 3D coordinates (x, y, z)
 */
export class OneEuroFilter3D {
    private xFilter: OneEuroFilter;
    private yFilter: OneEuroFilter;
    private zFilter: OneEuroFilter;

    constructor(config: OneEuroFilterConfig = {}) {
        this.xFilter = new OneEuroFilter(config);
        this.yFilter = new OneEuroFilter(config);
        this.zFilter = new OneEuroFilter(config);
    }

    filter(x: number, y: number, z: number, timestamp: number): { x: number; y: number; z: number } {
        return {
            x: this.xFilter.filter(x, timestamp),
            y: this.yFilter.filter(y, timestamp),
            z: this.zFilter.filter(z, timestamp)
        };
    }

    reset(): void {
        this.xFilter.reset();
        this.yFilter.reset();
        this.zFilter.reset();
    }
}

/**
 * Pre-configured filter for iris tracking
 * - Lower minCutoff for more smoothing (iris moves smoothly)
 * - Higher beta for responsiveness to quick eye movements
 */
export function createIrisFilter(): OneEuroFilter2D {
    return new OneEuroFilter2D({
        minCutoff: 0.8,    // More smoothing for jitter reduction
        beta: 0.5,         // Responsive to quick eye movements
        dCutoff: 1.0
    });
}

/**
 * Pre-configured filter for head pose tracking
 * - Balanced smoothing for head movements
 * - Less aggressive than iris (head moves more deliberately)
 */
export function createHeadPoseFilter(): OneEuroFilter {
    return new OneEuroFilter({
        minCutoff: 1.2,    // Less smoothing (head moves deliberately)
        beta: 0.3,         // Moderate responsiveness
        dCutoff: 1.0
    });
}

/**
 * Filter pool for managing multiple landmark filters
 */
export class LandmarkFilterPool {
    private filters: Map<number, OneEuroFilter3D> = new Map();
    private config: OneEuroFilterConfig;

    constructor(config: OneEuroFilterConfig = {}) {
        this.config = config;
    }

    /**
     * Get or create filter for a landmark index
     */
    getFilter(landmarkIndex: number): OneEuroFilter3D {
        if (!this.filters.has(landmarkIndex)) {
            this.filters.set(landmarkIndex, new OneEuroFilter3D(this.config));
        }
        return this.filters.get(landmarkIndex)!;
    }

    /**
     * Filter a 3D landmark
     */
    filterLandmark(
        landmarkIndex: number,
        x: number,
        y: number,
        z: number,
        timestamp: number
    ): { x: number; y: number; z: number } {
        return this.getFilter(landmarkIndex).filter(x, y, z, timestamp);
    }

    /**
     * Reset all filters
     */
    reset(): void {
        this.filters.forEach(filter => filter.reset());
    }
}

// Singleton instance for iris landmarks
let irisLeftFilter: OneEuroFilter2D | null = null;
let irisRightFilter: OneEuroFilter2D | null = null;

export function getLeftIrisFilter(): OneEuroFilter2D {
    if (!irisLeftFilter) {
        irisLeftFilter = createIrisFilter();
    }
    return irisLeftFilter;
}

export function getRightIrisFilter(): OneEuroFilter2D {
    if (!irisRightFilter) {
        irisRightFilter = createIrisFilter();
    }
    return irisRightFilter;
}

export function resetIrisFilters(): void {
    irisLeftFilter?.reset();
    irisRightFilter?.reset();
}
