%RT_MAKE_TREND_DATASET Seven daily SYNTHETIC sessions for one joint, for trying the Trends page.
%   Run from the matlab/ folder. Writes samples/trend/day1..day7 (CSV + JSON).
%   The movement amplitude changes gradually across the days so the ROM trend is visible.
%   This is simulation-generated data, not a measurement of any person.

outDir = fullfile('samples', 'trend');
if ~exist(outDir, 'dir'), mkdir(outDir); end
amplitudes = [92 96 101 99 106 110 113];      % degrees (synthetic)
startDay = datetime('2026-10-20 09:00:00', 'TimeZone', 'Asia/Kolkata');
for d = 1:numel(amplitudes)
    opts = struct('joint','knee','side','right','movement','flexion', ...
        'sampleRateHz',50,'durationS',16,'baseDeg',4,'amplitudeDeg',amplitudes(d), ...
        'periodS',4,'noiseSdDeg',1.0,'seed',100 + d, ...
        'startTime', startDay + days(d - 1), ...
        'outBase', fullfile(outDir, sprintf('synthetic_knee_right_flexion_day%d', d)));
    [t, a] = rt_generate_synthetic(opts);
    m = rt_analyse_session(t, a);
    fprintf('  day %d: observed ROM %.2f deg, repetitions %d\n', d, m.romDeg, m.repetitions);
end
fprintf(['Import these files one by one in RheumaTrack (Import movement -> Simulation-generated),\n' ...
         'and record a symptom check-in for the right knee within 2 hours of each start time\n' ...
         '(09:00 IST on each day) to see the Trends page association once 10+ pairs exist.\n']);
