import { useState, useEffect } from 'react';

export interface SEBContext {
    isInSEB: boolean;
    sebVersion: string | null;
    browserInfo: string;
    warnings: string[];
}

/**
 * Detect if application is running inside Safe Exam Browser
 * 
 * Detection methods:
 * 1. User-Agent contains 'SEB' or 'SafeExamBrowser'
 * 2. Custom SEB header (if configured)
 * 3. Window object properties (SEB API)
 */
export function useSEBContext(): SEBContext {
    const [context, setContext] = useState<SEBContext>({
        isInSEB: false,
        sebVersion: null,
        browserInfo: '',
        warnings: []
    });

    useEffect(() => {
        const userAgent = navigator.userAgent;
        const warnings: string[] = [];

        // Method 1: Check User-Agent
        const isSEB = /SEB|SafeExamBrowser/i.test(userAgent);

        // Extract SEB version if available
        const versionMatch = userAgent.match(/SEB[\/\s](\d+\.\d+)/);
        const sebVersion = versionMatch ? versionMatch[1] : null;

        // Method 2: Check for SEB API (window.SafeExamBrowser)
        // @ts-ignore - SEB may inject this
        const hasSEBAPI = typeof window.SafeExamBrowser !== 'undefined';

        // Generate warnings for non-SEB browsers
        if (!isSEB && !hasSEBAPI) {
            warnings.push('⚠️ Not running in Safe Exam Browser');
            warnings.push('For official exams, please use Safe Exam Browser');

            // Detect common browsers
            if (/Chrome/.test(userAgent) && !/Edge/.test(userAgent)) {
                warnings.push('Detected: Google Chrome (not allowed for exams)');
            } else if (/Firefox/.test(userAgent)) {
                warnings.push('Detected: Firefox (not allowed for exams)');
            } else if (/Edg/.test(userAgent)) {
                warnings.push('Detected: Microsoft Edge (not allowed for exams)');
            } else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
                warnings.push('Detected: Safari (not allowed for exams)');
            }
        }

        setContext({
            isInSEB: isSEB || hasSEBAPI,
            sebVersion,
            browserInfo: userAgent,
            warnings
        });

        console.log('[SEB Detection]', {
            isInSEB: isSEB || hasSEBAPI,
            version: sebVersion,
            userAgent
        });
    }, []);

    return context;
}
