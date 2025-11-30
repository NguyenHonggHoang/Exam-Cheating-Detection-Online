-- Fix exam times to ensure ACTIVE exams stay active longer
-- Update the 3 ACTIVE exams with extended end_time (7 days from now)

UPDATE exams SET 
    start_time = now() - interval '1 hour',
    end_time = now() + interval '7 days',
    updated_at = now()
WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

UPDATE exams SET 
    start_time = now() - interval '30 minutes',
    end_time = now() + interval '7 days',
    updated_at = now()
WHERE id = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

UPDATE exams SET 
    start_time = now() - interval '15 minutes',
    end_time = now() + interval '7 days',
    updated_at = now()
WHERE id = 'cccccccc-dddd-eeee-ffff-000000000000';

-- Ensure UPCOMING exam starts tomorrow
UPDATE exams SET 
    start_time = now() + interval '1 day',
    end_time = now() + interval '1 day 1 hour',
    updated_at = now()
WHERE id = 'dddddddd-eeee-ffff-0000-111111111111';

-- Ensure ENDED exam actually ended
UPDATE exams SET 
    start_time = now() - interval '3 days',
    end_time = now() - interval '3 days' + interval '45 minutes',
    updated_at = now()
WHERE id = 'eeeeeeee-ffff-0000-1111-222222222222';
