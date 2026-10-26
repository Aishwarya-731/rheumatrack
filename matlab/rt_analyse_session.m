function m = rt_analyse_session(tMs, angleDeg)
%RT_ANALYSE_SESSION Movement metrics, identical definitions to the web application.
%
%   m = rt_analyse_session(tMs, angleDeg)
%   m = rt_analyse_session(rt_read_movement_csv('file.csv'))   % struct input also accepted
%
%   Inputs must already be valid (ascending unique timestamps, >= 10 samples).
%   Outputs (fields of m):
%       sampleCount, minDeg, maxDeg,
%       romDeg            observed ROM = max - min (not a clinically validated ROM)
%       meanDeg           arithmetic mean of all samples
%       durationMs        last - first timestamp
%       interval.min/max/mean/median/sd/rateHz   successive differences (ms), SD = population
%       irregularIntervals   |dt - median| > 25 % of median
%       repetitions       hysteresis count (30 % / 70 % of ROM), [] when ROM < 5 deg

if isstruct(tMs)
    rec = tMs;
    tMs = rec.tMs;
    angleDeg = rec.angleDeg;
end
cfg = rt_config();
tMs = tMs(:);
angleDeg = angleDeg(:);
if numel(tMs) ~= numel(angleDeg), error('rt:size', 'tMs and angleDeg must have equal length.'); end
if numel(tMs) < 2, error('rt:size', 'At least two samples are required.'); end
if any(diff(tMs) <= 0), error('rt:order', 'Timestamps must be strictly increasing.'); end

d = diff(tMs);
med = median(d);

m.sampleCount = numel(angleDeg);
m.minDeg = min(angleDeg);
m.maxDeg = max(angleDeg);
m.romDeg = m.maxDeg - m.minDeg;
m.meanDeg = mean(angleDeg);
m.durationMs = tMs(end) - tMs(1);
m.interval.min = min(d);
m.interval.max = max(d);
m.interval.mean = mean(d);
m.interval.median = med;
m.interval.sd = std(d, 1);          % population SD, matches the app
m.interval.rateHz = 1000 / med;
m.irregularIntervals = sum(abs(d - med) > cfg.irregularTolerance * med);
m.repetitions = rt_count_repetitions(angleDeg, cfg);
end

function count = rt_count_repetitions(a, cfg)
count = [];
if numel(a) < 3, return; end
lo = min(a); rom = max(a) - lo;
if rom < cfg.repMinRomDeg, return; end
low = lo + cfg.repLowFraction * rom;
high = lo + cfg.repHighFraction * rom;
state = 0;          % 0 unknown, -1 below, +1 above
seenBelow = false;
count = 0;
for k = 1:numel(a)
    if a(k) <= low
        if state == 1 && seenBelow, count = count + 1; end
        state = -1;
        seenBelow = true;
    elseif a(k) >= high
        state = 1;
    end
end
end
