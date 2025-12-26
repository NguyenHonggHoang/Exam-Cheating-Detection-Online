import * as React from 'react';

// Simple class concatenation utility
function cn(...classes: (string | undefined)[]) {
    return classes.filter(Boolean).join(' ');
}

const Progress = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value?: number; max?: number }
>(({ className, value = 0, max = 100, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
        <div
            ref={ref}
            className={cn(
                'relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700',
                className
            )}
            {...props}
        >
            <div
                className={cn(
                    'h-full transition-all duration-300 ease-in-out',
                    percentage >= 75 ? 'bg-green-500' :
                        percentage >= 50 ? 'bg-yellow-500' :
                            'bg-red-500'
                )}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
});

Progress.displayName = 'Progress';

export { Progress };
