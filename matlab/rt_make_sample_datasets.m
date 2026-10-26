%RT_MAKE_SAMPLE_DATASETS Regenerate the SYNTHETIC sample datasets in matlab/samples/.
%   Run from the matlab/ folder. Every file is simulation-generated; none is a measurement.

if ~exist('samples', 'dir'), mkdir('samples'); end
specs = {
    % joint      side     movement          rate  dur  base  amp  period noise seed
    'shoulder', 'right', 'flexion',          50,  20,  5,   140,  5,    1.0,  11
    'shoulder', 'left',  'abduction',        50,  20,  5,   130,  5,    1.0,  12
    'elbow',    'right', 'flexion',          50,  16,  3,   120,  4,    0.8,  13
    'wrist',    'left',  'extension',        50,  12,  0,    55,  3,    0.6,  14
    'hip',      'right', 'flexion',          50,  20,  2,    95,  5,    1.0,  15
    'knee',     'left',  'flexion',          50,  20,  4,   115,  4,    1.2,  16
    'knee',     'right', 'flexion',          50,  20,  4,   120,  4,    1.2,  17
    'ankle',    'right', 'dorsiflexion',     50,  12,  0,    18,  3,    0.5,  18
};
for k = 1:size(specs, 1)
    s = specs(k, :);
    opts = struct('joint', s{1}, 'side', s{2}, 'movement', s{3}, 'sampleRateHz', s{4}, ...
        'durationS', s{5}, 'baseDeg', s{6}, 'amplitudeDeg', s{7}, 'periodS', s{8}, ...
        'noiseSdDeg', s{9}, 'seed', s{10}, ...
        'outBase', fullfile('samples', sprintf('synthetic_%s_%s_%s', s{1}, s{2}, s{3})));
    [t, a] = rt_generate_synthetic(opts);
    m = rt_analyse_session(t, a);
    fprintf('  observed ROM %.2f deg, mean %.2f deg, repetitions %d\n', m.romDeg, m.meanDeg, m.repetitions);
end
