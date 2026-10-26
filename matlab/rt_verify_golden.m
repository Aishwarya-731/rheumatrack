%RT_VERIFY_GOLDEN Compare MATLAB metrics with the reference values used by the web app.
%
%   Run from the matlab/ folder in MATLAB Online after uploading the whole project folder
%   (or at least matlab/ and reference/golden/).
%
%   For every reference/golden/*.csv, the metrics computed by rt_analyse_session.m are
%   compared with reference/golden/expected.json, which the TypeScript test suite
%   (src/domain/golden.test.ts) also checks. Agreement within 1e-9 in all three
%   implementations demonstrates the calculations are reproducible from the source samples.

goldenDir = fullfile('..', 'reference', 'golden');
expected = jsondecode(fileread(fullfile(goldenDir, 'expected.json')));
files = dir(fullfile(goldenDir, '*.csv'));
tol = 1e-9;
failures = 0;
fprintf('%-42s %10s %10s %6s  %s\n', 'file', 'ROM (MAT)', 'ROM (ref)', 'reps', 'result');
for k = 1:numel(files)
    name = files(k).name;
    key = matlab.lang.makeValidName(name);   % jsondecode turns "a.csv" into "a_csv"
    if ~isfield(expected, key)
        fprintf('%-42s missing from expected.json\n', name); failures = failures + 1; continue;
    end
    e = expected.(key);
    m = rt_analyse_session(rt_read_movement_csv(fullfile(goldenDir, name)));
    ok = m.sampleCount == e.sampleCount && m.durationMs == e.durationMs ...
        && abs(m.minDeg - e.minDeg) <= tol && abs(m.maxDeg - e.maxDeg) <= tol ...
        && abs(m.romDeg - e.romDeg) <= tol && abs(m.meanDeg - e.meanDeg) <= tol ...
        && abs(m.interval.median - e.interval.median) <= tol ...
        && abs(m.interval.mean - e.interval.mean) <= tol ...
        && abs(m.interval.sd - e.interval.sd) <= tol ...
        && m.irregularIntervals == e.irregularIntervals;
    if isempty(e.repetitions)
        ok = ok && isempty(m.repetitions);
    else
        ok = ok && isequal(m.repetitions, e.repetitions);
    end
    if isempty(m.repetitions), repText = '-'; else, repText = num2str(m.repetitions); end
    if ok, status = 'PASS'; else, status = 'FAIL'; failures = failures + 1; end
    fprintf('%-42s %10.4f %10.4f %6s  %s\n', name, m.romDeg, e.romDeg, repText, status);
end
if failures == 0
    fprintf('\nAll %d golden files match the reference within %g.\n', numel(files), tol);
else
    fprintf('\n%d file(s) did not match.\n', failures);
end
