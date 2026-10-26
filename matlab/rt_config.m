function cfg = rt_config()
%RT_CONFIG Analysis parameters shared with the RheumaTrack web application.
%   These values mirror src/domain/analysisConfig.ts exactly. They are data-quality and
%   signal-processing parameters, not clinical thresholds.

cfg.irregularTolerance = 0.25;  % |dt - median| > 25 % of median  -> irregular interval
cfg.repLowFraction     = 0.30;  % hysteresis low threshold  = min + 0.30 * ROM
cfg.repHighFraction    = 0.70;  % hysteresis high threshold = min + 0.70 * ROM
cfg.repMinRomDeg       = 5;     % repetitions not counted below this observed ROM
cfg.minSamples         = 10;
cfg.maxSamples         = 50000;
cfg.minAngleDeg        = -180;
cfg.maxAngleDeg        = 180;
cfg.formatId           = 'rheumatrack.movement.v1';

% Supported joint -> movements (must match src/domain/joints.ts)
cfg.movements = struct( ...
    'shoulder', {{'flexion', 'extension', 'abduction'}}, ...
    'elbow',    {{'flexion', 'extension'}}, ...
    'wrist',    {{'flexion', 'extension'}}, ...
    'hip',      {{'flexion', 'extension'}}, ...
    'knee',     {{'flexion', 'extension'}}, ...
    'ankle',    {{'dorsiflexion', 'plantarflexion'}});
end
